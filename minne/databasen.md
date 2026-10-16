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
2026-10-05 la till `admin_sett` (hur långt varje admin sett anmälningarna och
ansökningarna; var och en läser sin egen rad, bara `admin_sett_markera()`
skriver), kolumnerna `applications.vardnadshavare_epost`,
`vardnadshavare_godkand_at` och `vardnadshavare_svar`, och
`ansokan_utskick.skicka_efter` med stegen `vardnadshavare` och `avbojd`
(`minne/notiser.md`). Migrationen `ansokan_vardnadshavare_och_nej` börjar med
en vakt som jämför md5 för de fem funktioner den skriver om mot driften
2026-10-05, och stannar om någon av dem ändrats sedan: läs driften och skriv
om den hellre än att skriva över någon annans ändring. Den har ett `drop
constraint` (villkoret på steg går inte att vidga annars), som verktygen ber
om en bekräftelse för. Båda kördes 2026-10-06 avsnitt för avsnitt med
`execute_sql` och registrerades sedan med filens text (md5 som filen); varje
funktion och trigger jämfördes med en lokal databas byggd ur filen. Fram till
dess sparade Avböjd bara läget: koden låg i main men ingenting i driften, och
ett nej som klickats före migrationen köas aldrig i efterhand.
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
`avtal_som_text` (2026-10-05, avsnitt 1) la till `handlingar.innehall`:
ett avtal som klistras in i stället för att laddas upp. Villkoren
`handlingar_fil_eller_text` (aldrig båda) och `handlingar_innehall_langd`
(inte bara blanktecken, högst 200 000 tecken), BEFORE-triggern
`handlingar_texten_star_fast` (texten ändras aldrig, inte ens av admin;
en ny version är en ny handling), och `min_handling_text(id)`, som ger
texten till den den delats med och null för allt annat. `mina_handlingar()`
lappades med `replace()` och tar nu med en rad med text; en rad utan fil är
en text. `innehall` står INTE i auditloggens vitlista.
`admin_oppnar_chatten` (2026-09-29, avsnitt 1) la till `chatt_las()`:
tråden mellan en familj och en studiehjälpare för admin, SECURITY
DEFINER med `is_admin()` på första raden, VOLATILE för att den skriver
`chatt.oppnad` i `audit_logg`. Den rör aldrig `messages`.
`barnets_chatt` (2026-10-06) la till `barn_meddelanden`, barnets tråd med
studiehjälparen, och `barnchatt_las()` på samma sätt: `chatt.oppnad` med
`tabell = 'barn_meddelanden'`, och raden skrivs bara när det finns något
att läsa. Ingen inloggad skriver i tabellen; se `minne/barnkonton-och-admin.md`.
I drift sedan 2026-10-06 (version `20261006230000`).
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
`forsta_timmen_med_planen` (2026-10-09, `minne/betalning.md`) la till
`forsta_timmen_beviljad` (familjen läser sin rad, admin och den som läser
personer alla; ingen skrivpolicy, bara `ge_forsta_timmen()`),
`klippkort.forsta_timmen` och triggern `klippkort_forsta_timmen`,
`intern.forsta_timmen_tagen`, `intern.planens_forsta_timme`,
`intern.tva_timmar_hallna` och `forsta_timmen_lage()`, och skrev om
`forsta_timmen_bjuds`, `intern.tipstimmar_intjanade` och `tipskoder_lage`
i sin helhet med en vakt på md5:erna lästa i driften samma dag. Den byter
villkorens version till 2026-10-09. Ingen drop och ingen delete utanför en
funktion; går att köra två gånger. **I drift 2026-10-09**, efter merge av
PR #240 (a9238a7): filen kördes som ett `execute_sql` (den har ett
`delete` i `ge_forsta_timmen`, och då inte genom `http_get` och
`execute`, punkt 3 ovan), registrerades i ett do-block med texten hämtad
från merge-commiten och prövad mot sin md5 (`77916ceb…`), och de nio
funktionskropparna jämfördes med en lokal databas byggd ur filen: lika.
Hela `rls-test.sql` mot driften 1518 av 1518, tillbakarullat.
Den första tabellen i `intern` kom 2026-09-27: `intern.natanrop_logg`,
id:t på databasens egna pg_net-anrop (skrivs bara av `intern.natanrop()`,
ingen roll utom ägaren når den). Se Notiserna nedan.

`tipskoder_bonus_och_timbanken` (2026-10-13, `minne/affaren.md`) skriver om
`intern.leads_tipskod` (bara familjens och kampanjens kod) och `mina_tips`
med md5-vakter (`mina_tips` som `gratistimmarna_60_dagar` lämnar den, med
`kvar` och `kvar_till`, så den körs efter den), och lägger till
`applications.kod` med `intern.ansokan_tipskod`, tabellen `tipsbonus` med
`intern.tipsbonus_skydda`, `tipsbonus_audit` och triggern
`tutor_profiles_tipsbonus` (`intern.tipsbonus_vid_intag`), flaggan
`tipsbonus`, `intern.tipsbonus_ore`, `intern.ny_tipskod`, `koder_lage`,
`foretagsfakta.lonart_tipsbonus` (med auditlistan) och villkorens version
2026-10-13. `intern.radering_underlag` lappas med `replace()` och räknade
träffar: hindret `tipsbonus`, avidentifiering för den som har en bonus och
`tipsbonus` under `star_kvar`.
Ingen drop och ingen delete utanför en funktion.

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
**En driftsättning har EN session** (2026-10-13). Tre sessioner
driftsatte samma kedja efter #270 och #269 samtidigt, utan att veta om
varandra: `notis-ko` driftsattes tre gånger (v22–v24, alla
mains), och `barnet_foreslar_pass` kördes av två, den ena i sex delar
med en md5-vakt per del på `current_query()`, omlott med den andras hela
körning. Filerna gick att köra två gånger, så slutläget blev ändå det
lokala, men det visste ingen förrän en av dem skrev till de andra. Innan
du kör något i driften: lista sessionerna (`list_sessions`), fråga de som
arbetar i samma repo (`send_message`), och säg till när du är klar.
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
  fyller läxans text med beskrivningen, och den läser eleven. Alla sex
  ämnena i `NX.AMNEN` har blad, också Moderna språk (tyska, spanska,
  franska). De två programmeringsbladen togs bort 2026-10-07, när
  programmering slutade erbjudas: raderna är avstängda (`aktiv = false`,
  `20261007150100_programmering_erbjuds_inte`, i drift samma dag), inte raderade. **Bladen är skrivna med AI och granskade
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
  inte klickprovade, eftersom molnmiljön nekade alla de domänerna. 2026-10-03
  jämfördes varje adress med sökmotorernas index i stället: nio fanns exakt
  så, tre fanns inte och byttes (engelska nivå 1 och 2, Umeås tidigare prov
  i matematik), och PRIM-gruppens två rader pekar på sidan om proven
  (`20261003020000_materialbanken_lankarna_rattas`). Ett index är inte ett
  klick: en människa bör ändå trycka på dem en gång.
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
| `timmar-gar-ut` | :07 varje timme | mejlet tio dagar innan köpta eller gratis timmar går ut (Fas 21.2, gratis sedan `gratistimmarna_paminns`) |
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
   valet att gå vidare till intervju (`till_intervju_at`, 2026-10-15),
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
`namnlista()` i `nextrum-admin-karna.js`: namnet och läget, inget annat,
och i Ansökningar radens nästa steg som en knapp bredvid (2026-10-13,
`minne/vyerna.md`).
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
| `drop` (också `drop policy if exists`), `delete` utanför en funktion, en funktion med två `delete`, och 2026-10-13 en funktion med ett `delete` och två `update` (`ta_tillbaka_gratistimmar`, två gånger, ensam i anropet andra gången) | `create`, `alter`, `comment`, `grant`, `revoke`, `update … where`, en funktion med ett `delete` och inget `update` (tre sådana i ett anrop, `barnet_foreslar_pass`, samma kväll) eller en datamodifierande CTE, `do`-block, `select cron.unschedule(…)`, `select cron.schedule(…)` |

Frågan syns bara i en klient som visar verktygets bekräftelser: 2026-10-13 syntes den inte alls i Leos app, och
ingen ruta är inget ja. Säg det till Leo innan du kör något som utlöser den, och vänta inte på ett svar som inte
kan komma.

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
   En fil utan `drop`- och `delete`-satser kan i stället köras hel (barnets_behorigheter, 2026-10-07):
   hämta den från merge-commiten med `extensions.http_get`, pröva `md5` mot filens, vägra om versionen redan
   står i `schema_migrations`, och `execute` texten och registrera den i samma `do`-block. Allt eller inget,
   och raden är filen. Står `drop` eller `delete` i filen är det att runda spärren: då gäller punkt 2.
4. Bevisa funktionerna: `md5(prosrc)` i `pg_proc` mot samma text mellan `as $$` och `$$;` i filen. Ett byte
   fel syns direkt, och det är det enda som visar att en edge-funktion eller en kropp inte skrivits av fel.
   Tabellerna jämförs med samma frågor mot driften och en lokal databas (kolumner, villkor, index, policyer,
   triggrar, rättigheter). Rättigheterna skiljer alltid i `m` (MAINTAIN), som Postgres 17 i driften har och
   bilden lokalt (15) saknar (2026-10-14).
5. Röktesta en edge-funktion utan att skicka något: `select intern.natanrop('<mål>', url := k.<kolumn>,
   headers := jsonb_build_object('Content-Type', 'application/json', 'x-nextrum-notis', k.hemlighet), body :=
   jsonb_build_object('id', gen_random_uuid())) from notis_konfig k`, och läs `net._http_response` för id:t.
   Hemligheten lämnar aldrig databasen. En funktion med `verify_jwt` får den publika anon-nyckeln som token:
   funktionen själv ska svara 401, och utan token grinden (`sb-error-code`). Ett prov som ska ge 401 syns
   under System → Fel och på Översikt (`notisfel()`, med målet som källa) tills pg_net rensar svaret efter
   sex timmar (`pg_net.ttl`): döp målet `rokprov:<funktion>` och säg till den som läser adminvyn.
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

### Barnets behörigheter (barnets_behorigheter, 2026-10-06)
Kolumnen `students.barn_behorigheter` (text[], förval
`{chatt,meddelanden,nexlax,pass,studieplan}`, villkoret
`students_barn_behorigheter_kanda`), fyra hjälpare i `intern`
(`barn_behorigheter_alla`, `barnets_behorigheter`, `barn_behorigt`,
`mitt_nexlax_barn`), två funktioner för föräldern
(`mina_barns_behorigheter`, `barn_behorigheter_satt`), och
`students_barnkonto_audit` med kolumnen i listan. Arton funktioner
lappades med `replace()` på `pg_get_functiondef()` och en vakt som räknar
träffarna: `barn_oversikt` (två lappar), `barn_notiser`,
`barn_markera_last`, `barn_nexlax`, `niva_starta` (två träffar),
`niva_svara`, `niva_genomgang`, `nexlax_lage`, `barn_uppgift`,
`rapportera_fragefel`, barnets tre chattfunktioner, `barnchatt_skriv`,
`barnchatt_trad`, `barnchatt_tradar` (två lappar), `skydda_studentfalt`
(två lappar) och `skydda_studentfalt_ny`. Ingen `drop` och ingen
`delete`, så filen går att köra avsnitt för avsnitt utan bekräftelser.
Versionen `20261006233000` ligger efter `barnets_chatt`
(`20261006230000`, en annan session samma kväll), vars funktioner lappas;
första avsnittet stannar om den inte är körd. `rls-test.sql` avsnitt 22.
Kördes 2026-10-07 efter merge av PR #204 (`DEPLOY-BARNKONTON.md` 9): filen
hämtad från merge-commiten (43d2ef4), prövad mot sin md5 och körd och
registrerad i ett `do`-block (punkt 3 i receptet ovan), med de arton
funktionerna md5-lika med 2026-10-06 innan. `rls-test.sql` mot driften gav
1393 av 1394 före (avsnitt 22 stannade på att kolumnen saknades) och 1433
av 1433 efter. Se `minne/barnkonton-och-admin.md`.

### Användarvillkoren (villkoren_godkanns, 2026-10-07)
Tabellen `villkor_godkannanden` (kontot, versionen, tiden, källan;
primärnyckel konto och version, `on delete cascade` från `auth.users`, så
den går med kontot när det raderas helt och står kvar med ett
avidentifierat). RLS: kontot läser sina rader, och den som läser personer
i adminvyn läser alla (samma `har_nagon_behorighet`-lista som policyn på
`profiles`). Inga skrivpolicyer, och anon och authenticated har inga
skrivrättigheter. Fyra funktioner i `intern`: `villkor_version()` (sidans
datum; authenticated kör den, för `mitt_villkorslage()` läser som
anroparen), `villkoren_godkanda(uuid)` (svarar om en person och nås bara
av triggrarna), `villkor_vid_registrering()` (triggern
`auth_villkor_vid_registrering` på `auth.users`) och två triggerfunktioner
(`pass_kraver_villkor`, `kop_kraver_villkor`). Två i `public`:
`mitt_villkorslage()` (invoker) och `godkann_villkor(text)`, bara för
authenticated. Triggrarna skapas med `create or replace trigger`, så filen
har varken `drop` eller `delete`. `bookings_kraver_villkor` sorterar före
`bookings_timmarna_tillbaka`, som fortfarande är sist; den ändrar inget i
raden. Fixturerna i `rls-test.sql` har godkänt villkoren överst (de som
bokar och köper måste ha gjort det), och avsnitt 23 tar bort godkännandet
där det prövar spärren. Se `minne/sakerhet.md`, Användarvillkoren.
I drift 2026-10-07 efter merge av PR #208: filen från merge-commiten
(6286fc3), prövad mot sin md5 och körd och registrerad i ett `do`-block.
`rls-test.sql` mot driften: 1433 av 1434 före (avsnitt 23 stannade på att
`intern.villkor_version()` saknades) och 1459 av 1459 efter.

### Betygsgarantin (betygsgarantin, 2026-10-07)
Tabellen `betygsgarantier` (elev, läsår, ämne, betyget föräldern angav,
tiden, och rättelsens `andrad_at` och `andrad_av`; unik på elev, läsår och
ämne, `on delete cascade` från `students`). Ingen inloggad skriver i den:
`anmal_betygsgaranti()` skapar raden och `andra_betygsgaranti()` rättar den,
bara för den som har `anvandare_redigera`. RLS: föräldern läser sina barns
rader, och den som läser personer läser alla. RLS begränsar inte kolumner,
så authenticated har SELECT på en kolumnlista utan `andrad_av`. Ämnena står
i `intern.betygsgaranti_amnen()` och i `NX.GARANTI_AMNEN`. Triggern
`students_betygsgarantier_raderas` (AFTER, utan `UPDATE OF`) tömmer betyget
när barnet raderas, och jobbet `betygsgaranti-gallring` (03.56 UTC) den 1
oktober efter läsåret. Filen bytte också `intern.villkor_version()` till
`2026-10-07`; `create or replace` behöll rättigheten för authenticated.
Reglerna står i `minne/affaren.md`, Betygsgarantin.
I drift 2026-10-07 efter merge av PR #212: filen från merge-commiten
(d4adcc3), prövad mot sin md5 och körd och registrerad i ett `do`-block,
och alla sex funktionskroppar har filens md5. `rls-test.sql` mot driften,
från samma commit: 1490 av 1490. Säkerhetskontrollen efteråt hade inget
nytt utom de två RPC:erna i listan över vad inloggade får anropa, som
med flit. Driften är Postgres 17.6 och den lokala bilden 15.8; provet mot
driften är det som räknas.

### Provobjekten ska bort (provobjekten_tas_bort, 2026-10-07)
Tio funktioner `public.zz_prov_*` och tabellen `public.zz_prov_ddl` låg kvar
i driften efter ett prov 2026-10-02 av vilka satser verktygen ber om en
bekräftelse för. De skapades utan fil och gav nio varningar i
säkerhetskontrollen. Ingen roll utom ägaren nådde dem, men `zz_prov_k1` var
en kopia av morgonmejlets körning med SECURITY DEFINER och hade skickat mejl
om någon kört den. Migrationen tar bort dem med `drop` och ber därför om en
bekräftelse. **Ett sådant prov görs i en transaktion som rullas tillbaka,
aldrig med objekt som blir kvar.**
Första körningen 2026-10-07 hängde sig i 60 sekunder utan svar på
bekräftelsen; inget hände, och migrationen väntar (`DEPLOY-BARNKONTON.md` 10).

### Planerna (planerna_basic_standard_intensiv, 2026-10-07)
Kolumnen `timmar_pa_kopet` (int, förval 0, villkoren
`erbjudanden_timmar_pa_kopet_check` och `klippkort_timmar_pa_kopet_check`,
0 <= x < timmar, lagda i ett do-block efter en kontroll i `pg_constraint`)
i `erbjudanden` och `klippkort`. `erbjudanden_audit` och `klippkort_audit`
skapades om med `create or replace trigger` och har kolumnen i listorna.
Vyn `erbjudanden_pris` skapades om med de elva kolumnerna i samma ordning
och `timmar_pa_kopet` sist, och `pris_ore` räknar de betalda timmarna. De
gamla planerna stängdes med `aktiv = false`, och de nya lades in med `on
conflict do nothing`. Ingen drop och ingen delete, så filen körs hel i ett
do-block med en annan dollartagg än `$$` (filen har ett eget `do $$`).
Lokalt: 1505 av 1505, och 1489 av 1491 utan migrationen, där exakt 16.1d
och avsnitt 25 föll. **Körs efter merge, och `stripe-checkout` från main
driftsätts FÖRE den**: kassan läser hela raden med `*` och skriver
kolumnen bara när vyn har den, så den tål att migrationen saknas, och
inget glapp uppstår där en gammal kassa säljer Standard med "0 % rabatt"
(granskningen 2026-10-07). Ett väntande köp återanvänds bara med samma
innehåll (`sammaInnehall`), inte bara samma pris. **I drift 2026-10-07**,
efter merge av PR #224: först `stripe-checkout` v18 från main (2f12977),
hämtad tillbaka och byte för byte lika i alla sju filer, sedan filen från
merge-commiten genom `extensions.http_get`, prövad mot sin md5
(`f4835f34…`), körd och registrerad i samma do-block (`$kor$`). Raden i
`schema_migrations` har filens md5. Efteråt: `plan_basic` 144000 öre
(ordinarie 151600), `plan_standard` 265300 (303200, en timme på köpet),
`plan_intensiv` 432000 (454800), `standard` och `intensiv` av, vyns tolv
kolumner med `timmar_pa_kopet` sist, och `bookings_timmarna_tillbaka` sist
bland triggrarna på `bookings`. Hela `rls-test.sql` mot driften: 1505 av
1505, tillbakarullat. Advisorn larmade inte om något nytt.

### Fyll timbanken (fyll_timbanken, 2026-10-12)
Klippkorten `klipp10`–`klipp100` fick 0 % rabatt, `giltig_manader = 6` och
namnet "Fyll timbanken, N timmar" (raden i Stripes kassa), och
`intern.villkor_version()` blev 2026-10-12. Strömbrytarens beskrivning i
`flaggor` byttes med `flaggor_stampla` av runt den enda raden, som i
`fas14_9_bokforingen_i_fortnox`, och ett `do`-block efteråt prövar att
triggern är på igen (`tgenabled = 'O'`). Ingen drop och ingen delete, så
filen kördes hel. **I drift 2026-10-12**, direkt efter merge av PR #254:
filen från merge-commiten (2c19183) genom `extensions.http_get`, prövad mot
sin md5 (`e9a6025d…`), körd och registrerad i samma do-block (`$kor$`),
med en vakt mot att versionen redan fanns. Efteråt: klippkorten 39900 öre i
timmen och sex månader, villkoren 2026-10-12, strömbrytaren med ny text och
oförändrat `uppdaterad`, och `flaggor_stampla` på. Hela `rls-test.sql` mot
driften 1519 av 1519, tillbakarullat (ett nytt prov), och lokalt samma
siffra före merge. Advisorn larmade inte om något nytt.

### Barnets förslag och adminkontona i statistiken (2026-10-12)
**`20261012220000_barnet_foreslar_pass`**: kolumnen `students.far_boka`
(boolean, av), tabellen `barn_passforslag` med RLS (föräldern läser sina
barns; admin med `is_admin()` eller `bokningar_las`; inga skrivpolicyer,
och `nextrum_barn` och `anon` har inga rättigheter), hjälpare i `intern`
(`barnforslag_hjalpare`, `barnforslag_post_hoppas`, `barnforslag_las`,
`barnforslag_skickat`, `barnforslag_gallra`, och de två
raderingsfunktionerna), barnets fyra funktioner (bara `nextrum_barn`),
förälderns två (`barnforslag_neka`, `skicka_barnets_forslag`, den senare
SECURITY INVOKER så att policyn och alla triggrar på `bookings` gäller),
typen `barnforslag`, jobbet `barnforslag-gallring` (03.38 UTC) och
triggrarna `students_barnforslag_raderas` och
`profiles_barnforslag_raderas`. Lappade med `replace()` på
`pg_get_functiondef()` och en vakt som räknar träffarna:
`intern.barnets_behorigheter`, `barn_behorigheter_satt`,
`skydda_studentfalt`, `skydda_studentfalt_ny` och `intern.notis_skapa`;
en lappad funktion bär `far_boka` (eller `barnforslag`) och hoppas över.
`intern.barn_behorigheter_alla()` har `boka` på andra plats, i vyernas
ordning. `students_barnkonto_audit` skapades om med `create or replace
trigger` och har `far_boka` i listan. Ingen `drop`, inget `delete` utanför
en funktion, och ingen funktion med två: filen går att köra två gånger.

**`20261012220100_adminkonton_utanfor_statistiken`**:
`intern.utanfor_statistiken(uid)` (sant när kontot har en rad i
`admin_roller` och den som frågar är admin eller databasen själv; en
familj eller studiehjälpare som läser en analysvy får aldrig veta vem som
är admin) och de fem analysvyerna omskrivna med samma kolumner, i samma
ordning, och `security_invoker = true` utskrivet igen: ett pass där
familjen eller studiehjälparen är admin räknas inte, och en anmälan som
blev ett adminkonto inte heller. `analys_ekonomi` räknar inte längre
testbetalningar (`stripe_skarp = false`), som kärnan alltid sagt.
Passen, betalningarna, fakturorna och lönerna rörs inte: Betalningar,
Månadens ekonomi och Löner är bokföring och räknar som förut.

**`20261013100000_rabattkoden_krockar_inte`** (2026-10-13, samma gren):
`forsta_timmen_bjuds` lappad med `replace()` och en vakt som räknar
träffarna (två lappar: första timmen tar bort koden och läggs inte
ovanpå den, och tipstimmen ges också med en kod), och en ny trigger,
`bookings_timmar_betalar_utan_kod` med `intern.timmar_betalar_utan_kod()`,
som tar bort koden från ett pass som timmarna eller timbanken betalar
(`minne/betalning.md`). Skapad med `create or replace trigger`; namnet
lägger den mellan `bookings_timmar_betalar_forslaget` och
`bookings_timmarna_tillbaka`, som förblir den sista. Funktionen var i
driften 2026-10-13 byte för byte den lokala (md5 `570b7ccc…`). Lappen
känner igen sig själv (`rabattkoden_krockar_inte` i texten), så filen går
att köra två gånger.

**`20261013110000_gratistimmarna_60_dagar`** (2026-10-13, samma gren):
hjälparna `intern.gratis_till`, `intern.kortets_timmar` och
`intern.kortets_sista_dag`; `klippkort_saldo` omskriven med samma kolumner
och `gratis_kvar` och `gratis_till` sist, och `brukbar` som räknar med
dem (`security_invoker = true` utskrivet igen); `intern.timmar_betala` och
`klippkort_dra` omskrivna helt efter en md5-vakt (driftens text
2026-10-13: `ba9100a9…` och `282bdbd2…`), med gratis timmar först;
`intern.tipstimmar_oanvanda` och `intern.tipstimmar_kvar`; lappar med
`replace()` och en vakt som räknar träffarna i
`intern.timmar_betalar_obetalda` (förurvalet), `intern.timmar_gar_ut_koa`,
`forsta_timmen_bjuds` (två), `forsta_timmen_lage` (`beviljad_till`) och
`mina_tips` (`kvar`, `kvar_till`); och `intern.villkor_version()` =
2026-10-13. En funktion som redan bär `gratistimmarna_60_dagar` hoppas
över, och vakten släpper igenom en som redan är omskriven, så filen går
att köra två gånger. Allt i `minne/timmar.md`.

Versionerna var först `20261012120000` och `20261012120100`, men `fyll_timbanken`
kördes i driften samma kväll med just `20261012120000`; de ligger nu efter
den. Lokalt, byggd ur alla 186 migrationer: hela `rls-test.sql` 1603 av 1603
(avsnitt 26, 27, 28 och 29 är nya). **Körs efter merge, i den ordningen, och
`notis-ko` från main driftsätts FÖRE den första** (`minne/notiser.md`).
Vyerna tål att alla tre saknas: utan tabellen syns inga förslag, utan `boka`
i listan inget val, adminvyns tal räknar ur `admin_roller` själv,
utan `rabattkoden_krockar_inte` gäller den gamla ordningen i databasen,
vilket inte spelar någon roll så länge det inte finns någon kod, och utan
`gratistimmarna_60_dagar` saknas gratiskolumnerna, och vyn räknar då som
förut (den läser `klippkort_saldo` med `*`).

**Körda i driften 2026-10-13 kväll**, efter merge av PR #270 och #269
(28a0e8a), i den här ordningen: `notis-ko` från main (v22, v23 och v24
av tre sessioner, se ovan; v24 i driften är byte för byte 28a0e8a i alla
femton filer), `barnet_foreslar_pass` (med `execute_sql`, för filen har
tre `delete` i funktioner; registrerad efteråt med filens text ur
`extensions.http_get`; en annan session körde del 1–4 före och del 5–6
efter, och slutläget prövades igen efteråt: lika det lokala, ett
cronjobb `barnforslag-gallring`),
`adminkonton_utanfor_statistiken`, `rabattkoden_krockar_inte`,
`gratistimmarna_60_dagar` och `tipskoder_bonus_och_timbanken` (hämtade
från merge-commiten, prövade mot sin md5 och körda och registrerade i var
sitt do-block), `gratistimmar` (avsnitt för avsnitt, för filen har ett
`delete`) och `drift` v17 från main. Alla fem registrerade raderna har
filens md5. De två filerna som skrevs av för hand jämfördes med en lokal
databas byggd ur alla 188 migrationer (`md5(pg_get_functiondef())` och
rättigheterna, och tabellernas kolumner, villkor, index, policyer,
triggrar och jobb; de fyra i do-block är filens egen text):
`barn_foresla_pass` hade tappat en tom rad på vägen, hittad med md5 rad
för rad, och skapades om ur filen från `extensions.http_get` (inget
`delete` i den); resten var lika. **`ta_tillbaka_gratistimmar` kördes aldrig**: den har
ett `delete` och två `update`, och verktyget frågade efter ett ja tre
gånger utan svar (tabellen ovan); den tredje satt Leo vid skärmen och
svarade "kör", men ingen ruta syntes i hans app. Inget kördes; allt annat i
`gratistimmar` är inne och lika det lokala. 2026-10-14 skickade en annan
session avsnittet två gånger till (09.10 och 09.38 UTC), med samma utfall.
Avsnitt 7 ersattes: `timmarna_delas_och_kops_till` (nästa avsnitt) skrev
funktionen utan `delete` 2026-10-14, och `gratistimmar` registrerades i samma
do-block med filens text (md5 `079603c5e8d0566c0ebc086c4ff84d1f`) som första del
och en anteckning om avsnitt 7 som andra. Hela
`rls-test.sql` (24718559…) gick 1643 av 1643 mot driften i ett do-block
som hämtade både den och `gratistimmar` ur merge-commiten, körde
migrationen först (den går att köra två gånger) och slutade med `raise
exception`, så att inget blev kvar, inte heller återtagandet. Advisorn
larmade inte om något nytt för `anon`; `ge_gratistimmar`, `koder_lage` och
`mina_tips` är nåbara för `authenticated` och prövar själva
(`minne/sakerhet.md`). Ingen hade godkänt villkoren 2026-10-13 kl. 22.40,
och sajten med 28a0e8a var då ute (Vercel, READY, byggd från 22.14).

### Rabattkoden: timbanken, köpen, gränserna och taket (2026-10-13)
**`20261013160000_rabattkoden_timmar_och_tak`** (`minne/betalning.md`,
taket i `minne/sakerhet.md`): kolumnerna `rabattkoder.max_per_familj`
(null eller större än noll), `klippkort.rabattkod` (pekar på
`rabattkoder`) och `klippkort.rabatt_ore`; tabellen
`intern.rabattkod_forsok` (HMAC av kontot och tiden, RLS utan policy, inga
rättigheter) med `intern.rabattkod_forsok_nyckel`, `_notera` (ett `delete`
av det som är äldre än ett dygn, sedan försöket) och
`intern.rabattkod_for_manga`; hjälparna `intern.rabattkod_anvand`,
`intern.har_timmar`, `intern.kopets_tjanst` och prövningen
`intern.rabattkod_prova`; `kolla_rabattkod` omskriven (VOLATILE, taket) och
den nya `kolla_rabattkod_kop` (inte för `anon` eller `nextrum_barn`);
`skydda_rabatt` omskriven (låser kodens rad och prövar med
`intern.rabattkod_prova`); triggrarna `klippkort_rabatt` (BEFORE INSERT,
sätter `rabatt_ore` och `begart_ore`) och `klippkort_rabatt_star_fast`
(BEFORE UPDATE); `rakna_rabattkod` omskriven så att den räknar om ur passen
och köpen, med de nya triggrarna `bookings_rakna_rabattkod_andring`,
`klippkort_rakna_rabattkod` och `klippkort_rakna_rabattkod_andring`; och
sist räknas `antal_anvandningar` om för alla koder, också `TIPS` (noll i driften 2026-10-13).
`skydda_rabatt`, `kolla_rabattkod` och `rakna_rabattkod` skrivs om helt
efter en vakt som prövar driftens text 2026-10-13 (md5 på `prosrc`:
`49c29326…`, `96c3320c…` och `5698d597…`; `kolla_rabattkod` har en andra
summa, `407154d7…`, för den lokala databasen byggd ur arkivet, där
kommentarerna står kvar i kroppen). En funktion som redan bär
`rabattkoden_timmar_och_tak` släpps igenom, så filen går att köra två
gånger. Inget `drop`, inget `delete` utanför en funktion, och ingen
funktion med två. **PL/pgSQL skiljer inte på stora och små bokstäver**: en
variabel `r` i ett block som har konstanten `R` är samma namn, och
`rls-test.sql` avsnitt 32 heter därför `rd` och `tx`.

Lokalt, byggd ur alla 189 migrationer: hela `rls-test.sql` 1664 av 1664
(avsnitt 32 är nytt, 21 prov). **Körs efter merge, efter `gratistimmar`,
och `stripe-checkout` från main driftsätts FÖRE den** (`DEPLOY-BETALNING.md`
9.13). Vyerna tål att den saknas.

**I drift sedan natten till 2026-10-14** (00.15–00.30 svensk tid). De två
sessioner som var igång fick frågan och fem minuter på sig. Ingen svarade.
Sedan kördes i ordning:

1. `stripe-checkout` v19 från main (2de6d28), hämtad tillbaka: 7 av 7 filer
   byte för byte lika.
2. Vakten och avsnitt 1 i samma `execute_sql`, sedan ett anrop per avsnitt.
3. Registrering med texten hämtad från merge-commiten. `md5(statements[1])`
   är `e59f42f5…`, samma som filens.
4. Kontrollen: alla 13 funktioner och 6 triggrar har samma md5 på `prosrc`
   och `pg_get_triggerdef` som den lokala databasen.
5. Hela `rls-test.sql` från samma commit: 1664 av 1664 mot driften,
   tillbakarullat.

`gratistimmar` stod då till hälften i driften (`ta_tillbaka_gratistimmar`
saknades och versionen var oregistrerad, i väntan på Leos ja). Filen kördes
därför först i provblocket, så att avsnitt 30 prövade det som ska bli.
Avsnitt 33 (`kortet_reserveras`, som inte ska köras än) klipptes bort.

Advisorn larmade bara om två saker, båda med flit: `kolla_rabattkod_kop`
för `authenticated` och `intern.rabattkod_forsok` (RLS utan policy). Ingen
kod fanns utom `TIPS` (noll användningar). Strömbrytaren `erbjudanden` stod
på, så kassan med koden var skarp för köp från första stund. Provköpet i
testläge återstår (9.13 steg 4).

### Kortet reserveras vid bokningen (2026-10-13, i drift 2026-10-14)
**`20261013170000_kortet_reserveras`** (`minne/betalning.md`, Kortet
reserveras vid bokningen): strömbrytaren `kortreservation` (av);
`notis_konfig.kortreservation_url`, härledd ur arbetarens adress som
`admin_paminnelse_url`; tabellerna `stripe_kunder` (bara tjänstekontot),
`sparade_kort` (ett kort per familj; admin läser, familjen genom
`mitt_kort()`) och `kortreservationer` (ett val per pass; familjen och
admin läser, ingen inloggad skriver); auditloggen genom
`intern.logga_andring_nyckel()`, som är `logga_andring` med nyckeln som
andra argument, för tabellerna har familjen och passet som nyckel och
`logga_andring` läser objektet ur en kolumn som heter `id`; hjälparna
`intern.kortreservation_pa`, `passets_start`, `passet_kostar` (samma
räkning som `ej_betalt` i `avvikelser_rader`) och `kortet_betalar`;
familjens `mitt_kort()` och `valj_kort()` (en faktura som valts byts mot
kortet med familjens egen skrivning, som `skydda_bokningsfalt` prövar);
tjänstekontots `kort_sparat()`, `kort_borttaget()`,
`kortreservation_att_gora()` och `kortreservation_skriv()`; jobbet
`kortreservation` (var tionde minut) med `intern.kortreservation_vack()`
och `intern.kortval_stada()`; typen `kort_nekat` i båda listorna och
triggern `kortreservationer_nekat`, som bygger notisens data som
`notis_vid_pass` och skriver ett fel till `notis_fel` i stället för att
rulla tillbaka; och hindren `kort_sparat` och `kort_reserverat` i
`intern.radering_underlag`, lappad med ett ankare som räknas.
Delete står bara i `intern.kortval_glom`, `intern.kortval_stada` och
`kort_borttaget`, ett i var. Filen går att köra två gånger (lapparna
känner igen sig själva, och `cron.schedule` byter jobbet med samma namn).

Två saker provet hittade innan det gick grönt: en reservation med kort
giltighet hade släppts och gjorts om var tionde minut, så den släpps för
att passet flyttats bara när starttiden ändrats sedan reservationen
(`reserverat_for`); och en reservation som står fick först skrivas om
till nekad, vilket hade låtit ett nytt kort nollställa raden och tappa en
reservation som håller pengar. Lokalt, ur 190 migrationer: hela
`rls-test.sql` 1699 av 1699 (avsnitt 33 är nytt, 35 prov). **Körs inte
förrän resten är byggd, och `notis-ko` från main driftsätts före den**
(mallen `kort_nekat`).

**I drift 2026-10-14, 15.40–15.48 UTC**, efter funktionerna (`notis-ko` v25
först bland dem som behövs; `minne/betalning.md`, I drift). Ingen annan session
körde mot driften, och ingen av raderna fanns innan (inga tabeller, ingen flagga,
inget jobb). Filen delades i 19 delar som tillsammans är filen ordagrant (bara
tomraderna mellan delarna skiljer) och kördes i fjorton `execute_sql`, i
filens ordning, med varje funktion som har ett `delete` (`intern.kortval_glom`,
`kort_borttaget`, `intern.kortval_stada`) eller flera `update` i ett eget anrop.
Inget anrop frågade om en bekräftelse. Registrerad med filens text
hämtad från 1fbc18a (md5 `1a8c2ac0…`, 34 777 tecken). Sedan
`20261015090000_villkoren_kortet` hel i ett do-block (`http_get`, md5
`8effe953…`, vägrar om versionen redan står där, `execute` och registrering),
för den har ingen `delete` och ingen `drop`: `intern.villkor_version()` säger
2026-10-15. Jämfört med en lokal databas byggd ur main (193 migrationer): alla
20 funktioner (också de lappade `notis_typer`, `notis_mejlbara` och
`intern.radering_underlag`) med `pg_get_functiondef`, rättigheter och
kommentarer, tabellernas kolumner, villkor, index, policyer, triggrar och
kommentarer, jobbet och flaggan: lika. Tabellernas rättigheter skiljer bara i
`m` (MAINTAIN), som Postgres 17 i driften ger alla tabeller och bilden lokalt
(15) inte har (`authenticated=rm` på `sparade_kort` och `kortreservationer`, som
på `barn_passforslag`). Hela `rls-test.sql` 1739 av 1739 mot driften,
tillbakarullat, före och efter strömbrytaren. Advisorn: inget nytt för `anon`;
`mitt_kort()` och `valj_kort()` går att anropa inloggad (familjens egna, och de
prövar `auth.uid()`), och `stripe_kunder` har RLS utan policy (bara
tjänstekontot), båda med flit. Strömbrytaren slogs på 15.47:57, och jobbet
`kortreservation` (nr 42) gick första gången 15.50.

### Timmarna delas och köps till (timmarna_delas_och_kops_till, 2026-10-14)
**`20261014100000_timmarna_delas_och_kops_till`**: kolumnerna
`bookings.forsta_klippkort_id` (FK, `on delete set null`) och
`forsta_klippkort_timmar`, `klippkort.aterkallad_at` och `till_plan` (FK,
`restrict`), fem CHECK-villkor och ett index; katalograden `plan_extra`;
hjälparna `intern.passets_korttimmar`, `intern.kortets_anvanda` och
`intern.timmar_fordela` (bara `service_role` utöver ägaren) och rättigheten
för `service_role` på `intern.kortets_timmar`, `intern.gratis_till` och
`intern.kortets_sista_dag` (felet i driften, `minne/timmar.md`); vyerna
`klippkort_saldo` (samma kolumner, och `aterkallad_at`, `till_plan` och
`rabatterat_timpris_ore` sist) och `klippkort_rorelser` (samma kolumner, en
rad per kort och pass); `intern.timmar_betala`, `klippkort_dra`,
`intern.timmar_betalar_kommande`, `intern.timmar_betalar_obetalda`,
`intern.timbank_in`, `skydda_klippkortet`, `ta_tillbaka_gratistimmar`,
`klippkort_betald` och `intern.timmar_gar_ut_koa` omskrivna helt efter en
md5-vakt (texten i en databas byggd ur alla migrationer 2026-10-13; en som
bär `timmarna_delas` släpps igenom, så filen går att köra två gånger); den
nya triggern `bookings_forsta_kortet_foljer`, `bookings_skydda_klippkortet`
och `klippkort_audit` omskapade med `create or replace trigger`;
`extra_timmar_erbjudande` (`authenticated` och `service_role`); bonusens
text i `flaggor` med `flaggor_stampla` av runt raden; och
`intern.villkor_version()` = 2026-10-14.

**Ingen `drop` och ingen `delete`** (ordet står bara i två främmande nycklar
och i auditens `or delete`, som körts i do-block förut), så filen kan köras
hel i ett do-block ur merge-commiten, som `tipskoder_bonus_och_timbanken`.
Det var skälet att återtagandet av gratistimmar blev en tidsstämpel: med
ett `delete` och två `update` krävde verktyget ett ja som inte syntes.

**Före körningen i driften**: pröva vakterna (md5 i avsnitt 0 mot driften,
också `ta_tillbaka_gratistimmar`, som inte finns där), att inget pass med
`startrabatt` redan har ett kort (`select count(*) from bookings where
klippkort_id is not null and startrabatt` ska vara 0; ett sådant hade fått
en timme tillbaka), och vem som mer kör mot driften. **Efter**: registrera
`20261014100000`, och `20261013140000` om den inte redan står där (med en
anteckning om att avsnitt 7 ersattes), driftsätt `stripe-checkout` och `drift`
från main och hämta tillbaka dem, kör hela `rls-test.sql` mot driften
tillbakarullat (avsnitt 33 hoppar över sig självt så länge `kortet_reserveras`
inte är körd), och se att advisorn inte larmar om något nytt för `anon`
(`extra_timmar_erbjudande` är nåbar för `authenticated` och svarar bara om den
inloggade).

**`kortet_reserveras` (20261013170000) körs efter den här i driften**, fast
numret är lägre. De skriver inga gemensamma objekt, och `kortet_betalar()`
kräver `klippkort_id is null`, som fortfarande stämmer: `forsta_klippkort_id`
kräver `klippkort_id` (`bookings_forsta_kortet_med_kort`). Lokalt i den
ordningen (till och med `rabattkoden_timmar_och_tak`, den här, sedan
`kortet_reserveras`): hela `rls-test.sql` 1738 av 1738. `stripe-checkout` från
main bär sedan PR #275 kortets lägen (`kort: 'spara'` och `'ta_bort'`), men de nås
bara med `kort` i anropet, och att spara kräver strömbrytaren `kortreservation`,
som inte finns före migrationen; passens och köpens kassa är som förut.

**I drift 2026-10-14, kl. 9.43–10.00 UTC** (Leos ja 9.38, efter merge av PR #276
som 721e4b0). Före: alla tio vakterna stämde mot driften, inget pass med
`startrabatt` hade ett kort, `ta_tillbaka_gratistimmar` saknades, inga andra
frågor gick, och de två andra sessionerna hade svarat (den för PR #270 att dess
två försök med avsnitt 7 samma morgon gått ut utan att något körts). Ett do-block
hämtade filen och `gratistimmar` ur 721e4b0 med `extensions.http_get`, prövade
dem mot sina md5 (`ab3d031f…`, `079603c5…`), körde filen och registrerade båda,
`gratistimmar` med anteckningen om avsnitt 7 som `statements[2]`. Efter:
`md5(prosrc)` för alla 15 funktioner filen skriver är lika en lokal databas byggd
ur filerna, `service_role` får köra alla sex hjälparna, katalograden `plan_extra`
finns och `flaggor_stampla` står på igen. `drift` v18 (5 filer) och
`stripe-checkout` v20 (7 filer) driftsattes från 721e4b0 och hämtades tillbaka
byte för byte lika. Hela `rls-test.sql` (`8c71c67e…`) gick 1703 av 1703 i ett
do-block som slutade med `raise exception`; avsnitt 33 hoppade över sig självt,
så inget klipptes. Advisorn: inget nytt för `anon`, och det enda nya för
`authenticated` är `ta_tillbaka_gratistimmar`, som prövar `is_admin()` först.

### Till intervju (ansokan_till_intervju, 2026-10-15)
Kolumnen `applications.till_intervju_at`: när admin skickade ansökan vidare
till intervju (Skicka vidare till intervju eller ett bokat möte). Fliken
Intervju i adminvyn läser den, aldrig läget Kontaktad (`minne/vyerna.md`).
`skydda_ansokningsfalt` nollar den på en ansökan utifrån och behåller den vid
en ändring som inte är admins, `intern.ansokan_gallras_fran` räknar den som
ett steg, och `applications_audit` och `applications_audit_borttagen` tar
tidpunkten. `ansokan_besked` lyssnar inte på den: inget mejlas. Ingen
bakåtfyllning. Funktionerna och triggrarna prövas mot driften som den lästes
2026-10-15 (md5 på `pg_get_functiondef` och `pg_get_triggerdef`), och
`create or replace trigger` byter dem utan `drop`. `rls-test.sql` proven TI.
**I drift 2026-10-15**, direkt efter merge av PR #289 (b85b892), som Vercel
driftsatte 19.31 UTC: de tre andra sessionerna i repot fick veta före (ingen
svarade på fem minuter) och efter. Filen hämtades från merge-commiten genom
`extensions.http_get`, prövades mot sin md5 (`344c91c4…`) och kördes och
registrerades i samma do-block (`$kor$`), med en vakt mot att versionen redan
fanns. Ordet `delete` står i filen bara i `after delete on` i triggerns
definition, ingen sats, så den kördes hel. Efteråt: båda funktionerna, alla
sju triggrar på `applications`, kolumnen, kommentaren och rättigheterna byte
för byte lika en lokal databas byggd ur filerna, raden i `schema_migrations`
med filens md5, och ingen ansökan med steget satt. Hela `rls-test.sql` från
b85b892 gick 1745 av 1745 mot driften i ett do-block som slutar med ett fel
(allt rullades tillbaka), och inget blev kvar. Advisorn larmade inte om något
nytt.

### Familjerabatterna (familjerabatter, 2026-10-15, i drift 2026-10-16)
Tabellerna `familjerabatter` och `familjens_rabatt`, kolumnerna
`bookings.familjerabatt_ore` och `klippkort.familjerabatt_ore`, och fem
funktioner och vyn `klippkort_saldo` omskrivna mot driften som den lästes
2026-10-15 (`minne/betalning.md`, Familjerabatterna). `rls-test.sql` avsnitt
35 (`FR`).
**I drift natten till 2026-10-16**, direkt efter merge av PR #293 (8b28e1a),
som Vercel driftsatte 23.50 UTC: de två andra sessionerna i repot (PR #292 och
#296) fick veta före och efter, och ingen av dem körde mot driften. Filen
hämtades från merge-commiten genom `extensions.http_get`, prövades mot sin md5
(`8348b94c…`) och kördes och registrerades i samma do-block (`$kor$`), med en
vakt mot att versionen redan fanns. Filen har inget `drop` och inget `delete`.
Vakterna (md5 på de fem kropparna och på vyns definition) stämde. Efteråt:
alla kroppar byte för byte filens (`md5(prosrc)`), raden i `schema_migrations`
med filens md5, de tre kolumnerna, fyra policyer, fyra triggrar och RLS på
plats, inga rättigheter för `anon` eller `nextrum_barn`, `authenticated` får
läsa och skriva koderna och läsa familjernas rader (policyerna prövar
`is_admin()`) och köra `min_familjerabatt()` och `satt_familjerabatt()`,
`intern.familjerabatt` körs bara av ägaren, och inga rader i de nya tabellerna.
Vyn har `familjerabatt_ore` sist, och `md5(pg_get_viewdef('public.klippkort_saldo'::regclass, true))`
är nu `e4bf8d23…` (var `a34041ef…`): en migration som vaktar vyn ska läsa
driften igen. Hela `rls-test.sql` från 8b28e1a (`ebb2ac5e…`) gick 1775 av 1775
mot driften i ett do-block som slutar med ett fel (allt rullades tillbaka), och
advisorn larmade inte om något nytt för `anon`. `stripe-checkout` v21 och
`drift` v21 gick ut från samma commit, och båda svarade 401 på ett röktest
genom `intern.natanrop` med den publika nyckeln som token (punkt 5 i Att köra
en migration i driften från en session, och `minne/funktioner.md`).

### Nivåerna och prövningen (nexlax_i_adminvyn och betygsgarantin_provas, 2026-10-15)
Vad de gör står i `minne/nexlax.md` (nivåerna i adminvyn) och
`minne/affaren.md` (prövningen av ett anspråk). Ingen av filerna har `drop`
eller `delete`.
**I drift natten till 2026-10-16**, direkt efter merge av PR #287 (0c30568,
00.19 UTC, på Leos "Merga"). Sessionerna för PR #292 och #293 fick veta före
och efter. Varje fil hämtades från merge-commiten genom `extensions.http_get`,
prövades mot sin md5 (`6124842e…`, `07e17698…`) och kördes och registrerades
i ett eget do-block (`$kor$`), med vakter mot att versionen eller funktionerna
redan fanns. Efteråt var `md5(prosrc)`, `security definer`, `proconfig` och
rättigheterna för alla sex funktionerna (`nexlax_banor`, `nexlax_nivaer`,
`intern.nexlax_forsok_raknas`, `betygsgaranti_underlag`, `intern.lasaret` och
`mina_elevers_garantiamnen`) lika en lokal databas byggd ur filerna, och
raderna i `schema_migrations` hade filernas md5. **De kördes efter
`familjerabatter`** (20261015210000), som var körd före dem, fast numren är
lägre: de skriver inga gemensamma objekt. Hela `rls-test.sql` från 0c30568
(`c6a994a6…`) gick 1791 av 1791 mot driften i ett do-block som slutar med ett
fel, så allt rullades tillbaka. Det första försöket stoppades av blockets egen
kontroll innan något kördes: svansen som klipps bort är 74 tecken, inte 77.
Advisorn: inget nytt för `anon`. De fyra nya för `authenticated` skyddar sig
själva: `nexlax_banor`, `nexlax_nivaer` och `betygsgaranti_underlag` släpper
bara fram superadmin, och `mina_elevers_garantiamnen` ger bara
studiehjälparens egna elever (`is_my_student`).
