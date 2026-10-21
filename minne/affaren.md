# Affären: flödet, passen och det runt dem

Arkivet för avsnitt 1 i `CLAUDE.md` utom betalningen (`betalning.md`), timmarna (`timmar.md`)
och NexLäx (`nexlax.md`), ordagrant, med driftsättningen och det som är kvar ur avsnitt 11
bredvid det den gäller. Reglerna står i kärnan, `CLAUDE.md`; "avsnitt N" i texten är kärnans.

---

## 1. Affären, i ordning

Det här är inte en katalog man bläddrar i. Nextrum matchar.

1. Familjen skickar **intresseanmälan** → rad i `leads`
2. Ni ringer och väljer studiehjälpare
3. Admin tar in familjen: **Ta in familjen** på anmälan (2026-10-06).
   Kontot skapas med anmälans adress, eleven ur anmälan, och familjen
   väljer lösenordet genom länken i mejlet. Inget Skapa konto på sajten
   (2026-10-07): konton skapar bara vi (`bjud-in`) och föräldern (barnets
   inloggning). Sist flyttar anmälan till familjen (nedan, 2026-10-21)
4. `admin.html` → **Familjer** → välj hjälpare i rullgardinen. Sätter
   `matched_tutor_id` och `match_status` **samtidigt** — förr var det
   två kolumner i Table Editor och satte man bara den ena såg familjen
   en låst vy utan att förstå varför
5. Föräldern lägger in barnet, hjälparen skriver studieplanen

Före steg 4 är föräldravyn öppen (2026-10-07, Leo: "han kommer inte in
på plattformen, det är låst. ta bort så att det inte är låst"). Förut
stannade en omatchad familj i ett väntläge, och sedan intaget är det
varje ny familj: lösenordet, villkoren och introduktionen, och sedan ett
lås som dessutom bad dem skicka en intresseanmälan de redan skickat. Nu
kommer de in med barnen, NexLäx och profilen, och `S.väntar` i
`nextrum-studie-vy.js` håller det som kräver en studiehjälpare:

- **Boka pass** visar en spärr i stället för kalendern. Policyn på
  `bookings` släpper igenom `tutor_id` null, så det är vyn som stoppar
  förslaget; ingen studiehjälpare kan svara på det.
- **Erbjudanden**: Köp är avstängt, och raden ovanför korten säger att
  timmarna köps när vi matchat dem. Ingen ska betala för timmar innan vi
  vet vem som håller dem.
- **Meddelanden**: tråden har ingen att skriva till och säger det;
  hälsningens kort säger Öppnas när ni är matchade.
- **Översikt**: Att göra börjar med Vi letar studiehjälpare åt er, som
  leder till barnen tills det finns ett och sedan till NexLäx. Raden
  räknas inte i siffran.
- Introduktionens sista bild säger vad som öppnas när vi matchat dem
  (`VÄNTAR` i `nextrum-introduktion.js`).

Matchningen öppnar resten vid nästa laddning, utan att något annat
ändras.

**Vi ringer alla** (2026-10-11, Leo): intresseanmälan frågar inte längre
om vi ska ringa eller mejla först. Kontaktvalet (2026-10-03) gick, för
de som valde mejl svarade sedan inte på mejlen. Telefon och e-post är
obligatoriska: telefonen för samtalet (minst sju siffror, så att "nej"
inte tar sig förbi), e-posten för kvittot och sedan inbjudan till
kontot. Familjen får skriva när ett kort samtal passar (valfritt), och
"Tider för passen" heter så för att inte blandas ihop med det. Telefonen
och tiden står som första rader i `message` ("Telefon: …", "Passar att
ringa: …"), före familjens text, eftersom databasen kapar message
bakifrån vid 4000 tecken; förut stod numret sist och kunde klippas bort.
Ingen egen kolumn: då behövdes ingen migration, och `lead-notis` mejlar
det redan i meddelandet. Tacket säger alltid att vi ringer
(`tackIntresseRing`).

**Timmarna i ansökan** (2026-10-03): den som söker svarar ja eller nej
på om hen kan jobba minst 4 timmar i veckan. Inget förval. **Fyra timmar
är meriterande, inget krav** (Leo 2026-10-03): ett nej stoppar inte
ansökan, och raden under valet och svaret på "Hur mycket behöver jag
jobba?" (`faq.html`, `bli-studiehjalpare.html`, båda språken) säger
detsamma. Blir det ett krav ändras de tre samtidigt. Svaret står som första rad i `applications.why`
("Minst 4 timmar i veckan: ja"), av samma skäl som telefonen i intresseanmälan, genom
`kopplaAnsökan`s `överst()`; sidans kontroll går genom `kontroll()`.
Kontrollen och valet delar stilen `.nx-val` (som kontaktvalet i
intresseanmälan använde till 2026-10-11).

**Under 18 i ansökan** (2026-10-05): åldern under 18 fäller ut
vårdnadshavarens e-post, som krävs och inte får vara den egna. Den går som
en egen kolumn (`kopplaAnsökan`s `kolumner()`), inte i `why`, eftersom
databasen mejlar den. Vårdnadshavaren svarar till info@ med barnets för-
och efternamn, och admin lägger in svaret i ansökan. Hela kedjan står i
`minne/notiser.md` (Vårdnadshavarens godkännande).

**Avböjd mejlar ett nej** (2026-10-05), tidigast en halvtimme senare och
aldrig på kvällen. Se `minne/notiser.md`, regel 4.

**Intaget** (2026-10-06). Leo: "när man ska ta in en anställd är det
krångligt att skapa konto åt den, samma med familj in i poolen. de
behöver skapa konto och allt skit". Nu skapar adminvyn kontot i samma
tryck som personen tas in, med personens egen adress:
- **Ta in familjen** (rutan på en intresseanmälan, `nextrum-admin-kunder.js`):
  `bjud-in` med `lead_id` skapar kontot och mejlar länken, `leads.kund_id`
  kopplar anmälan till kontot, eleven skapas ur anmälan, och anmälan blir
  matchad. Kvittot säger vad som hände och var eleven finns; Välj
  studiehjälpare är steg 4. Har familjen redan ett konto är rutan Skapa
  elev, som förut. Går eleven inte att skapa efter kontot står familjen
  kvar i rutan och knappen blir Skapa elev.
- **Ta in i poolen** (ansökan, `nextrum-admin-rekrytering.js`), sedan
  2026-10-21 **Utbildning hållen** (nedan, Ansökningarnas steg): har
  adressen i ansökan inget konto skapas det med `roll: 'tutor'` före
  godkännandet, som sedan är detsamma som för ett konto som fanns; kvittot
  säger att två mejl går (länken och välkomstmejlet).
- Personen trycker på länken, väljer lösenordet två gånger, går igenom
  introduktionen och trycker Fortsätt (`minne/sakerhet.md`, Konton vi
  skapar). Väntar familjen på sin matchning, eller studiehjälparens
  profil på att godkännas, säger introduktionens sista bild det.
- **Skicka inbjudan igen** står i personens panel (`nextrum-admin-detalj.js`)
  för en förälder eller studiehjälpare, alltid sedan 2026-10-07: före första
  inloggningen en ny inbjudan, sedan Skicka länk för lösenord. Bara det
  senaste mejlet fungerar (`minne/sakerhet.md`).
- **Inget Skapa konto** (2026-10-07, Leo: "ta bort att man skapa konto på vår
  sida, vi gör det genom inbjudan"): familjer kommer in genom Ta in familjen,
  studiehjälpare genom Ta in i poolen, och inloggningen är en för alla, där
  kontot avgör vyn (`minne/barnkonton-och-admin.md`, En inloggning).
- Leo bad om lösenordet 12345678 för alla nya konton. Det blev en länk i
  stället, för samma steg för personen; varför står i
  `minne/sakerhet.md`.

## Ansökningarnas steg (2026-10-21, `ansokningarnas_steg`)

Leo: "Lägen: Ny, Intervju, Utbildning, Konto skapat. En ansökan finns i
exakt ett läge åt gången. Vyn 'Alla ansökningar' visar bara de som ligger i
Ny. ... Statusövergångar tvingas i databasen (trigger). Tillåtet: ny till
intervju, intervju till ny (ångra), intervju till utbildning, utbildning
till konto skapat." Och om profilen: "Korta ner intervjudelen kraftigt:
status plus tre knappar, inget annat."

**Steget räknas, det lagras inte en gång till.** `applications.steg` är en
genererad kolumn ur `intern.ansokan_steg(konto_id, status, till_intervju_at,
intervju_at, utbildningsmote_at, utbildad_at)`: konto_skapat när kontot är
kopplat eller läget är Godkänd, utbildning när intervjun är hållen eller
utbildningen påbörjad, intervju när hen skickats vidare, annars ny.
Tidsstämplarna fanns redan och läses av gallringen, auditloggen och mejlen;
ett eget lägesfält bredvid dem hade varit en andra sanning. "Exakt ett läge"
gäller därför av konstruktion. Funktionen körs som den som skriver raden,
också anon när ansökan skickas, så den har EXECUTE för alla (som en funktion
bakom ett CHECK-villkor). Ändras regeln ska kolumnen räknas om: en lagrad
genererad kolumn räknas bara när raden skrivs.

**Vakten** (`intern.ansokan_steg_vakt`, BEFORE INSERT OR UPDATE, efter
`applications_skydda` i namnordning) släpper bara de fyra bytena, för admin
också, och Konto skapat bara genom `ansokan_utbildning_hallen()`, som sätter
`nextrum.ansokan_konto` i transaktionen. `konto_id` skrivs aldrig för hand
(42501), och en ansökan utifrån får aldrig ett. Databasen själv
(tjänstekontot, gallringen) och en ändring en annan trigger eller kaskad gör
(`pg_trigger_depth() > 1`, ett raderat konto) går förbi. Ett nej är inget
steg: det går i varje steg, och går att ta tillbaka. Två äldre prov i
`rls-test.sql` hoppade över steg (16.1 och 22.1) och går nu i ordning.

**Loggen** (`ansokan_steg_logg`): en rad per steg, varifrån, vart, vem och
när, skriven av databasen efter skrivningen. Den ändras aldrig, inte ens av
ägaren (triggrar), och raderas bara med sin ansökan (kaskaden, ett steg
djupare). Bara superadmin läser. Ansökningarna som fanns fick en rad med
sitt steg.

**Granskningen 2026-10-21**: en superadmin kunde runda stegen genom Avböjd
(`status = 'rejected'` med `intervju_at`, sedan `status = 'new'`, gav steget
Utbildning utan Intervju och utan intervjumejl) och genom en INSERT av en
ansökan som redan var Godkänd. Nu börjar en ny ansökan alltid i Ny, utom för
databasen själv, och medan en ansökan är (eller blir) Avböjd står stegets
kolumner still, så ett ja tar den tillbaka till steget den hade. Loggen
stoppade radering av en person som stod i den (nyckeln `andrad_av … on
delete set null` gjorde en UPDATE som triggern nekade): en ändring där bara
`andrad_av` blir null släpps igenom när en annan trigger eller nyckel gör den
(`pg_trigger_depth() > 1`). Backfillen av loggen fick sina tider skrivna
över av `now()`: tiden sätts nu bara när den saknas. Provat: `rls-test.sql`
avsnitt 47 (`AS`, tre prov till), och de två äldre proven (16.1 och
Intervjumejlet) som gick genom Avböjd tar nu felet 23514.

**Skicka intervjulänk igen** (`ansokan_intervjulank_igen()`): samma mejl som
när hen skickades vidare, köat i notiskön med nyckeln
`ansokan_intervju:<id>:igen:<millisekunder>`, bara i steget Intervju och
högst en gång i tio minuter. Kön (`notis_utskick_ta`) skickar ett
intervjumejl bara medan ansökan står i Intervju. Utan
`INTERVJU_BOKNINGSLANK` säger knappen det och inget köas: mallen har länken
hårdkodad (`intervju.ts`), och `kolla-mejltexter.py` håller den lika
configen, så en tom config är en länk som inte ska gå ut.

**Utbildning hållen** (`ansokan_utbildning_hallen(p_ansokan, p_konto,
p_timpenning, p_amnen, p_ort)`): kontot skapas före, av `bjud-in` med
ansökans adress (409 betyder att adressen hann få ett, och då kopplas det),
och funktionen kopplar det, godkänner profilen med ämnena, orten,
timpenningen och ansökans skola, ålder, tider och tjänster, och sätter
utbildad och Godkänd, i en transaktion. Samma konto igen svarar `redan`, ett
annat konto nekas, ett konto med en annan adress nekas, och ett konto hör
till en ansökan (unikt index). Välkomstmejlet går som förut (läget blir
Godkänd i samma ändring som utbildad, så sista steget mejlas inte), och
bonusen för tips följer `tutor_profiles.status` som förut (sedan
värvningsbonusen samma dag tjänas den in när kontot kopplas eller blir
godkänt, nedan).

**Panelen**: steget och dess knappar överst (`.ans-nu`), sedan uppgifterna
(Skriv till hen vid adressen), det hen skrev och Mejlen till hen hopfällda
(fäller ut sig när ett mejl inte gått fram), och Avböj ansökan. Fliken
Rekryteringen, Boka digitalt möte, Skicka utbildningen, Utbildningsmötet är
hållet och Markera utbildad är borta, och läget sätts inte längre med
märkena. Webbläsarprovet är `verktyg/prova-ansokningar.js` (138 prov).

## Anmälan flyttar till familjen (2026-10-21, `anmalan_flyttas_till_familjen`)

Leo: "när en intresseanmälan blir en familj ska en SECURITY DEFINER-funktion
intag_lead(lead_id) (a) kopiera källa, kampanj och utm till familjens profil,
(b) markera familjen som intagen och (c) radera lead-raden så den inte tar
plats i listan. Bygg samma sak som knapp i admin. Hira finns redan som
familj: gör en engångsfix för henne." Och om matchningen: Intagen ska stå på
familjen och Matchad på barnet.

**Varför inte på profilen.** `profiles` skyddas av en lista över kolumner
familjen INTE får skriva (`skydda_profilfalt`); en ny kolumn där hade varit
skrivbar för familjen själv, och källan är vår uppgift, inte deras. Den står
därför i `intagna_anmalningar`, med anmälans id och familjens id, och
familjens panel i adminvyn visar den (Intagen, när de anmälde sig, varifrån,
koden). Bara `intern.intag_lead` skriver; de som läser intresseanmälningar
läser.

**Varför inte bara radera anmälan.** Tre saker läser den efter att familjen
blivit kund: tipstimmen (`intern.tipsade_familjer` hittar den nya familjen
genom anmälan och koden), koderna (`mina_tips`, `tipskoder_lage`,
`koder_lage` räknar anmälningarna) och statistiken (`analys_konvertering`,
`analys_leads_per_kalla`: blev_kund är just de som flyttas). Alla fem läser
båda tabellerna. Utan det hade familjen som tipsat förlorat sin timme.

**Vem och hur.** `intag_lead(anmälan, familj)` är bara superadmin, som Ta in
familjen: familjen är den som anges, annars anmälans `kund_id`, annars den
enda familjen med anmälans adress. Telefonnumret ur meddelandets första rad
går till profilen om den saknar ett. Ta in familjen anropar den sist, och en
anmälan som tagits in före 2026-10-21 (eller där flytten föll) har knappen
**Flytta till familjen** i sin panel. En anmälan som redan flyttats svarar
med det, så knappen går att trycka två gånger.

**Matchningen** låg redan på barnet (`students.matched_tutor_id`,
`match_status`, sedan schema-v14); `profiles` bär bara en spegel av det
första matchade barnet. Adminvyn visar **Intagen** på familjen (läget
`matched` på en anmälan heter Intagen) och **Matchad** på barnet. Ingen
policy flyttades.

**Gallringen**: meddelandet och adressens frågesträng gallras som i `leads`,
sex månader efter kontakten, och `radera_person` tömmer dem för en familj
som raderas. Resten står kvar för statistiken, och familjens id blir tomt när
kontot tas bort helt.

**Hira** (en familj som fanns innan anmälan kopplades): filen kopplar
anmälan med förnamnet Hira, utan `kund_id`, till familjen med samma adress
eller förnamn och flyttar den. Hittas inte exakt en av varje görs ingenting,
och en NOTICE säger varför. Går att köra igen. Provet i webbläsaren är
`verktyg/prova-intag.js`.

## Uppstarten

**Intresseanmälan säger att Nextrum bildas** (2026-09-29). Leo: "just
nu ska vi samla in kunder men vi är inte registrerade ännu ... ska det
stå att just nu bildas vi och vi kan påbörja läxhjälpen om ungefär 3
veckor". En ruta i sidhuvudet på `intresseanmalan.html` och `/en/`,
stilad i `nextrum-uppstart.css`, med en bana från Nu till vecka 43 (45 sedan 2026-10-09).
Dagen står i `data-uppstart` (måndagen 19 oktober, nu 2 november), och "om ungefär tre
veckor" räknas om ur den av `NX.uppstart()` vid varje visning: skrivet
för hand hade det varit fel efter en vecka, mitt i kampanjen. När dagen
passerat står "inom kort", aldrig en dag bakåt i tiden. Tacket efter
anmälan säger detsamma (`tackIntresseUppstart`) så länge rutan finns.
Flyttas starten: byt `data-uppstart` OCH veckan i banan, på båda
sidorna. **Flyttad till vecka 45** (2026-10-09, Leo: "vi kan börja läxhjälp
om ungefär 1 vecka ändra de till ungefär 3 veckor"): måndagen 2 november,
så att det räknade avståndet blir tre veckor; samma dag i
`nextrum-affisch.js` och på affischen, och redan utskrivna affischer
säger fortfarande vecka 43. **Rutan ska bort när passen har börjat**: den på båda sidorna,
och länken till och filen `nextrum-uppstart.css`. Tacket går tillbaka av
sig självt.

**Formuläret överst (2026-10-08).** Leo: "När jag går in på
intresseanmälan knappen vill jag direkt komma till ansöknings formuläret
nu måste jag scrolla för komma dit. Ha formuläret högst upp. Och ovan en
liten text där de står just nu bildas Nextrum ... så som den ser ut nu men
mindre och smalare". Sidhuvudet (tillbakalänken, etiketten, den stora
rubriken och ingressen) gick, och klassen `nx-har-uppstart` med det.
Sidan är en sektion (`section.nx-anm#intresse`, cinema): rutan om
uppstarten som en låg remsa (ikonen, rubriken i fetstil i meningen och
banan; en rad från 760 px), och under den formulärets yta med `h1` och
ingressen överst, före stegen och svaren i markupen, så att formuläret
kommer först också på en telefon. Inget `data-stig` på remsan och
formuläret: det man kommer för ska synas direkt. Rubriken och
ingressen är desamma som förut, så delningsbilden står kvar. Villkoren och
integritetspolicyn säger redan att Nextrum AB är under bildande; de
ändras när bolaget är registrerat, vilket inte behöver vara samma dag.

## Bokningen

**Användarvillkoren först** (2026-10-07): den som föreslår ett pass och den
som bekräftar en tid har godkänt den gällande versionen, annars nekar
databasen (`bookings_kraver_villkor`), och timmar köps bara åt en familj
som gjort det. Avbokningen stoppas aldrig. Se `minne/sakerhet.md`.

**Ett pass bokas i två steg (Fas 15.1).** Familjen trycker på en dag i
en tom kalender, väljer ämne, tid och antal barn och FÖRESLÅR tiden.
Studiehjälparen accepterar eller föreslår en annan under Föreslagna
tider, och först då står passet under Mina lektioner. Det finns inga
veckotider längre: `tutor_availability` läses inte av något, och
triggern som bekräftade bokningar inom dem är borttagen. En avbokning
kräver ett skäl (fast kod), och motparten får det i mejlet (Fas 15.2).
Väljer familjen ämnet Annat måste de skriva vilket, och det skrivna
ordet är det som sparas i `bookings.subject` (2026-09-25). Mejlen
läser ämnet genom `fornamn()`, så fritexten når dem som ett ord.
Tiderna börjar klockan 11 på vardagar och klockan 9 på lördag och
söndag, och slutar senast 22 (`HELA_DAGEN` i `nextrum-arbetsyta.js`,
som förslaget och flytta-rutan delar). Leo 2026-09-28: "man ska inte
kunna skicka förfrågan innan 11 på vardagar, helger ska man kunna
skicka förfrågan tidigast kl 9", samma kväll som 11 först gällde alla
dagar. Det är passets starttid, inte när förslaget skickas. Röda dagar
mitt i veckan räknas som vardagar. Listan började 07:00, och Leos "man
kan inte föreslå tider före 11:00" från 2026-09-25 lästes då som en
felanmälan i stället för en regel.
Regeln står bara i vyn, som resten av fönstret: databasen spärrar inga
timmar, och en flik som laddats före en ändring erbjuder de gamla
tiderna tills den laddas om. Samma dag går det bara att föreslå tider
minst en timme fram, och tidsraden säger det — annars ser det ut som
att dagens första timmar saknas.

**Ångerrätten står i villkoren** (`#angerratt`, 2026-09-25): 14 dagar
från att passet är bokat. Villkoren nämnde den inte alls förut, och
utan informationen förlängs fristen med upp till tolv månader (lagen
om distansavtal 2 kap. 13 §). Att ett genomfört pass inte går att
ångra, och att en påbörjad del betalas, gäller bara för att familjen
UTTRYCKLIGEN bett att passet hålls inom fristen — den begäran är att
föreslå tiden, och meningen om det står sist i bokningens dagpanel.
Tas meningen bort faller undantaget. Planer och klippkort (Fas 16.1)
har samma ångerrätt, räknad från köpet, och den går inte att avtala
bort. Inom fristen får vi bara behålla en andel av det AVTALADE priset
för de timmar som använts (2 kap. 15 §), alltså det rabatterade.
Regeln att använda timmar räknas till ordinarie pris vid köpet (379 kr till 2026-10-08, sedan 399) när en familj slutar
gäller först efter fristen — adminvyn visar rätt belopp efter datumet
(`vid_anger_ore` och `vid_uppsagning_ore`, Fas 16.1e).

**Förslaget bär var man ses (Fas 15.6).** Online, eller På plats med en
adress i `bookings.location`, och en valfri rad till studiehjälparen i
`note`. Fas 15.1 hade tagit bort frågan, och ett förslag hade då ingen
plats alls. Förval ur förra passet och barnets `format_onskemal`.
Platsen ändras inte när tiden flyttas — `skydda_bokningsfalt` släpper
bara igenom tid och status på ett befintligt pass.

**Barnet kan föreslå pass (barnet_foreslar_pass, 2026-10-12)**, när
föräldern slagit på det för barnet (`boka`, av som förval). Förslaget
går till föräldern, utan pris, och blir ett pass först när föräldern
skickat det, kanske med en annan tid, som sitt eget
förslag (`skicka_barnets_forslag()`). Studiehjälparen svarar på passet
som på vilket förslag som helst. Ett förslag föräldern själv gör går som
förut. Allt om det i `minne/barnkonton-och-admin.md`.

**Ett pass tar ingen rabattkod** (sedan 2026-10-21, `koder_for_planer`,
Leo: "Båda gäller ENBART planköp, aldrig enskilda pass"). Rabattkoder och
partnerkoder skrivs när familjen köper en plan, under Erbjudanden. Från
2026-10-13 till dess stod en ruta för en kod i Boka pass, och en gratis
timme och timbanken gick före koden (`rabattkoden_krockar_inte`). Allt om
det i `minne/betalning.md`.

## Svaret på en föreslagen tid och avbokade pass

**Svaret på en föreslagen tid och avbokade pass (2026-09-30).** Leo bad
om tre svar på familjens tid: acceptera, avslå med ett obligatoriskt
meddelande, eller föreslå en annan tid med ett valfritt, och att
familjen svarar ja eller nej på motförslaget ("ingen pingpong"). Och att
avbokade pass inte ska ta plats, men att antalet ska synas över tid.
Migrationen `avbokningar_och_svar` bygger det på Fas 15.1:s modell.
- **Inga nya statusar, med flit.** Beställningen ville ha `avslagen`,
  `motforslag` och `motforslag_avbojt`. Ett motförslag ÄR fortfarande en
  flyttad tid på ett `requested`, och ett avslag ÄR `cancelled`:
  `klippkort_saldo`, timmarnas jobb, krockvillkoret, raderingen och ett
  trettiotal funktioner räknar på de fyra statusarna, och ett avslag med
  en ny status hade behållit familjens köpta timme utan att något blev
  rött.
- **Inga pass tas bort, med flit.** Beställningen ville radera avbokade
  pass efter 30 dagar. Ett avbokat pass kan bära en återbetalning, en
  tvist, ett timbanksuttag och ligga i en stängd månad, och
  `analys_avbokningar` räknar ur raderna. Vyerna visar avbokade pass i en
  hopfälld grupp sist i passlistan (`o.avbokade` i `NXStudie.passLista`),
  bara de senaste 30 dagarna, och antalet räknas ur raderna.
- **`avbokad_fran`** är statusen när passet avbokades, stämplad av
  `stampla_avbokningen`. Räknaren i gruppen räknar bara `confirmed`: ett
  förslag som avslås eller dras tillbaka är ingen avbokning. Vem som
  avbokade läses ur `avbokad_av` mot `parent_id` och `tutor_id`, som
  `analys_avbokningar` gör. Fylld bakåt ur auditloggen; pass avbokade
  före Fas 6.1 står som null, okänt.
- **`svar_meddelande`** är studiehjälparens rader, högst 500 tecken:
  KRÄVS när hen avslår en tid familjen föreslagit, valfritt med ett
  motförslag, och skrivs av passets studiehjälpare i samma skrivning
  (`skydda_bokningsfalt`). Fritext, till skillnad från avbokningens
  fasta skäl (Fas 15.2): "den tiden har jag träning" är inget av fyra
  skäl. Därför står den bara i vyerna: inte i auditloggens vitlista,
  inte i någon notis eller något AI-verktyg, och `svar-gallring` tömmer
  den 30 dagar efter avslaget eller passet. `radera_person()` tömmer den,
  och månadslåset släpper igenom tömningen som för plats och rad.
- **`motforslag_at`** stämplas när den som fick ett förslag svarar med
  en annan tid. Den som fick motförslaget svarar ja eller nej och flyttar
  inte tiden igen; den som gav det får ändra sitt eget tills det är
  besvarat. Undantaget är kortpengar på passet: då går nej inte härifrån
  (Fas 14.1), och en ny tid är det enda svaret utom ja. Ett bekräftat
  pass som flyttas är ett nytt förslag, och tappar det gamla svaret.
- **Mejlen är orörda.** `pass_avbojt` och `pass_flyttat` sa redan att ett
  svar finns, med knappen till `#lektioner/pass`, och bär aldrig texten.
  `notis-ko` behövde inte driftsättas.
- Familjen ser ett avslag från den senaste veckan under Översikt, med
  Föreslå ny tid: i den hopfällda gruppen hade det bara stått i mejlet.
- **Vyerna tål att migrationen saknas** (`NXStudie.passMedSvar`): de
  driftsätts vid merge och migrationen körs efteråt, och en fråga efter
  en kolumn som inte finns ger 42703 för hela listan. Utan kolumnerna
  avslår studiehjälparen som förut, utan text.
- `NXStudie.medan()` stänger av knappen medan anropet pågår. Förut
  stoppade `aria-busy` bara musen: Enter på en knapp med fokus gav ett
  andra svar på ett pass som redan besvarats.

Driftsättningen, ur avsnitt 11:

- **Svaret på en föreslagen tid och avbokade pass (2026-09-30, avsnitt
  1) är i drift sedan 2026-09-30.** Migrationen kördes efter att PR #155
  mergats, med versionen i filnamnet (`20260930000000`): databasen
  hämtade filen från merge-commiten med tillägget `http`, prövade md5,
  körde den och skrev raden i `schema_migrations` i samma transaktion,
  så `created_by` är tom, och tillägget togs bort igen. Det driften
  sparade har samma md5 som filen. Innan dess hade de fyra funktionerna
  migrationen lappar samma md5 i driften som i en databas byggd ur
  filerna (`verktyg/lokal-databas.sh`), så vakterna träffade det de
  letar efter. Hela `rls-test.sql` gick igenom före, i en transaktion
  som rullades tillbaka med migrationen inläst, och efter: 975 av 975.
  Lokalt föll 32 rader utan migrationen, alla i det nya avsnittet eller
  i de fyra prov som utökades. Bakfyllnaden gav alla sju avbokade pass i
  driften en `avbokad_fran`: fem bekräftade, två förslag. Vyerna gick ut
  vid merge och tålde att kolumnerna saknades under tiden.

## Meet-länken

**Ett bekräftat onlinepass har en Meet-länk (Fas 18.1).** Den står under
Var på passets sida, likadan hos familjen och studiehjälparen, och
skapas av `google-meet` första gången någon öppnar passet, inte av en
trigger. Rummet är öppet (den som har länken går in utan att knacka),
för på ett pass är ingen från Nextrum med och släpper in. Blir rummet
inte öppet sparas länken inte. Är Google inte kopplat står den gamla
texten kvar: länken kommer i meddelanden. Leo valde bara det här av
Workspace-kopplingen; kalendern, inbjudningarna och rekryteringsmötet
valdes bort, och mejlen går genom Resend som förut (INTEGRATIONER.md).
Intervjun bokas sedan 2026-10-20 på en bokningssida i Google Kalender,
utan koppling: länken står i mejlet till den som söker
(`INTERVJU_BOKNINGSLANK`, `minne/vyerna.md`).

Ur avsnitt 11:

- **Google Workspace ger bara Meet-länkar, och är inte kopplat än**
  (Fas 18.1). Koden, tabellerna och Koppla-knappen finns; kopplingen
  kräver stegen hos Google i `INTEGRATIONER.md` och ett klick på
  Koppla Google, inloggad som `info@nextrum.se`. Tills dess står den
  gamla texten om meddelanden kvar på passen. Kalendern, inbjudningarna
  och rekryteringsmötets länk valdes bort. Integritetspolicyn säger
  samma sak sedan 2026-10-07 (den lovade Meet innan något var kopplat)
  och ändras samma dag som kopplingen, `INTEGRATIONER.md` steg 9. Fortnox stod här som en
  ogjord koppling till Fas 14.8. Sedan Fas 14.9 sköts bokföringen,
  fakturorna och lönen i Fortnox, med flit utan koppling hit.

## Passets sida, månaderna och studiehjälparens vy

**Varje pass har en egen sida, `#pass/<id>`, i båda vyerna.** Ritas av
`NXStudie.passSida`; vyn bestämmer innehållet (familjen ser pris och
betalning, studiehjälparen eleven och familjen). Raderna i listorna
leder dit och bär bara det som är ens eget drag just nu — svara,
betala, skriva rapporten. Föreslå ny tid och avboka ligger på sidan.

**Studiehjälparens rapporter och ersättning visas månad för månad**
(2026-09-27): "man ska inte kunna se rapporter från juli idag i
september". Förvalet är den innevarande månaden. Statistiken (Hur passen
gick) läser fortfarande de tjugo senaste.

**Familjens bekräftade rapporter likaså** (2026-09-28, Leo: "bekräftade
rapporter ska filtreras efter månad"): Bekräftade under Bekräfta rapport
har samma rad, på PASSETS månad, och raden är dold tills något är
bekräftat. Att bekräfta filtreras inte. Två saker kom fram i provbänken:
- **En månadsrad som skapas i en dold sektion visade fel månader.**
  Föräldravyns rad och studiehjälparvyns två skapas vid start, när
  sektionen är dold, och bredden noll gjorde att den valda månaden aldrig
  fördes in i bild: när sektionen öppnades stod oktober förra året
  längst till vänster och september låg utanför, på telefon och dator.
  `månadsval` för nu fram den valda när raden börjar synas.
- **`håll()` kan inte scrolla förbi sidans slut.** Listan står sist, och
  en kortare månad längst ned på sidan klämde scrollen: raden flyttade
  sig 84 px under fingret på en telefon. `rbBytMånad` låter listan
  behålla höjden tills tomrummet ligger under skärmkanten. Samma sak
  finns sedan 2026-09-29 som `NXStudie.hållLista` (avsnitt 3, fälla 1).
  Studiehjälparvyns två rader har bara `håll()`.

**Adminvyns Lektioner likaså** (2026-09-29, Leo: "lektioner, där ska man
kunna filtrera för månader, i admin. lättare att se över en mängd
lektioner under en specifik tid"). Samma rad som Ekonomi, Månadens
ekonomi och Löner, men en egen, på passets månad, och talen överst gäller
månaden. Raden ersatte väljaren 30 dagar, tre månader, hela tiden, och
två saker den gav står kvar på annat sätt: en månad med hållna pass utan
rapport är märkt i raden ("2 saknas"), så att larmet inte gömmer sig i en
månad som inte är vald, och ett sök räknar upp sina träffar i andra
månader med en knapp dit. Raden har varje månad sedan september 2026
(`alla`): hela tiden nådde varje pass. Sedan samma dag
hämtas alla pass, inte de tusen första (avsnitt 3, Tusen rader). Byts månaden mot
en tom på en telefon klämmer sidan scrollen 15–25 px. Det är inte lagat,
med flit: på en dator står raden så högt att det inte händer, och en
reserv som `rbBytMånad` lämnade 311 px tomrum kvar på en kort sida.

**Studiehjälparens schema öppnar i Kommande** (2026-09-24): de närmaste
passen per dag, med klockslag och ämne, elevens namn och platsen på var
sin rad. Studievyn och adminvyn öppnar fortfarande i månaden — hos
familjen står schemat direkt under passlistan, och Kommande hade bara
upprepat den.

**Plan & utveckling börjar med vem man skriver om** (2026-09-28, Leo:
"man kan ha flera elever därför behöver man välja"). Med flera elever
står studieplanen och kunskapsområdena dolda tills studiehjälparen själv
tryckt på en elev: där, under Mina elever, eller på ett elevkort eller en
länk i elevens rad ovanför Läxor och Meddelanden. Namnet står sedan i
rubrikerna. Blev eleven aktiv av något annat (den första i listan, en
familj i meddelandelistan, ett pass) frågar fliken igen: `S.elevVald`
minns vem man tryckt på, inte bara att man tryckt. Förut skrev
formulären på den första eleven tills man bytt, och rutan som sa vem
det var stod ovanför sektionen, 800 px över formuläret på en telefon.
Rutan står därför inte längre under Lektioner & elever, bara ovanför
Läxor och Meddelanden. En enda elev väljs inte; kortet säger bara vem.

## Utbildningsprovet i studiehjälparvyn (2026-10-21, `utbildningsprovet_i_studiehjalparvyn`, i drift sedan 2026-10-20)

Leo: ett prov som studiehjälparen gör vid första inloggningen, innan studiehjälparvyn öppnas. Mer än 50 %
rätt är godkänt (55 % sedan 2026-10-20) och gränsen står i en inställning; provet görs en gång; den som inte klarar det gör om det
efter 24 timmar, och admin kan nollställa. Rättningen sker på servern, facit når aldrig webbläsaren, och
spärren står i databasen. Den gäller först när det finns minst fem aktiva frågor (till dess en varning i
adminvyn), de som var godkända före migrationen slipper, och admin slår på och av kravet per person.
De två som slapp har alltså inte gjort något prov, fast FAQ:n och Så fungerar Nextrum säger att alla studiehjälpare
klarat ett prov innan de matchas. Leo 2026-10-20: "Alla kommer att utbildas snart". Texten stämmer för dem först
när Kräv provet slagits på och de klarat det, och medan kravet gäller ser de inga elever.

**Det är det enda provet sedan 2026-10-21.** Provet i rekryteringen (Fas 22.1: `utbildningsprov.html`, som den som
sökte skulle göra genom en länk innan hen hade ett konto) togs bort med `provet_i_ansokan_tas_bort`, Leos svar
samma kväll ("ta bort gamla"); ingen hade gjort det. Utbildningsmötet öppnar inget och mejlar inget, och Markera
utbildad frågar först och mejlar sista steget. Vad som gick och vad som står kvar som historik:
`minne/notiser.md`, Utbildningsprovet i ansökan.

**Tabellerna.** `prov_installning` (en rad: `grans_procent` 55 sedan 2026-10-20, 50 till dess, `min_aktiva_fragor`
5, `vantetid_timmar` 24),
`prov_fragor` (frågan, 2–6 alternativ, `ratt_svar` som index, `aktiv`, `ordning`), `prov_forsok` (varje
inlämnat försök med svaren och vilka som var rätt) och `prov_studiehjalpare` (läget per person: `kravs`,
`utbildningsprov_godkant_at`, `aterstalld_at`, `undantagen`). **Läget står inte på `tutor_profiles`**:
`skydda_tutorfalt` släpper bara vitlistade kolumner när studiehjälparen själv ändrar sin rad, och provet lämnas
in som studiehjälparen. Ingen rad i `prov_studiehjalpare` betyder att provet krävs, och de som var godkända när
filen kördes fick en rad med `kravs = false` och "godkänd före provet (2026-10-21)". Ingen inloggad har
skrivrättigheter på någon av dem: allt går genom funktionerna.

**Spärren** är `intern.provet_sparrar(uid)`: sant för den som har en rad i `tutor_profiles`, ingen adminroll,
inte klarat provet och inte är undantagen, när minst `min_aktiva_fragor` frågor är aktiva. Den ligger i
restriktiva policyer på `bookings`, `students`, `lesson_reports`, `messages`, `study_plans`, `tutor_reviews`,
`notiser` och `profiles` (den egna raden syns alltid), i `is_my_student()` och i barnchattens tre funktioner.
Läxorna, materialet, utvecklingen och NexLäx-försöken bygger på `is_my_student()`, och förberedelsen, mötet,
tilläggen, timbankens uttag och uppdragen läser `bookings` och `students` i sina policyer: de spärras med dem.
Det som inte spärras är med flit: den egna profilen och `tutor_profiles` (vyn behöver dem), lönen och
underlagen (de egna), och `upptagna_tider()` för den egna kalendern (datum och timmar, inga namn).
Familjerna och admins spärras aldrig.

**Funktionerna.** `mitt_utbildningsprov()` säger läget och lämnar frågorna utan facit bara när provet ska göras
nu (`kravs` är spärren, inte kolumnen). `lamna_in_utbildningsprov(p_svar)` låser personens rad, prövar spärren,
att provet inte redan är klarat och att väntetiden gått, kräver ett heltal för varje aktiv fråga (frågas en ny
fråga in medan någon skriver får hen "Svara på alla frågor" och läser in sidan igen), sparar försöket och svarar
bara `{ratt, antal, godkand}`. Godkänt är **mer än** gränsen: med 50 % och sex frågor är tre rätt underkänt,
och med 55 % och 26 frågor krävs 15. Mer än och minst 55 % skiljer sig bara när antalet aktiva är 20, 40, 60
eller 80.
`spara_provfraga()` och `satt_provinstallning()` är superadminens; `satt_provkrav()`, `aterstall_utbildningsprov()`
och `utbildningsprovet_lage()` också den med behörigheten Godkänna. En nollställning sätter `aterstalld_at` och
tar bort godkännandet: försöken står kvar men räknas inte för väntetiden. Ingen fråga tas bort, den stängs av.

**Vyn.** `nextrum-provet.js` (`NXProvet.förstGörs`) körs i studiehjälparvyns start för en godkänd
studiehjälpare, direkt efter lösenordet och före villkoren och introduktionen (2026-10-20, Leo: "först välja
lösenord och sen provet"; förut kom villkoren före provet). Rutan är samma som lösenordets och villkorens och går inte att stänga:
frågorna som radioknappar, Lämna in, och sedan godkänt med Fortsätt eller underkänt med tiden då provet går att
göra om och Logga ut. Svarar databasen inte, eller saknas funktionen, visas ingen ruta.

**Adminvyn.** Ansökningar → Provet i vyn (`nextrum-admin-provet.js`, bara superadmin): varningen när spärren
inte gäller än, frågorna med det rätta svaret markerat, Lägg till fråga, Stäng av och Slå på (frågar först om
det tar spärren under gränsen), gränsen, spärren och väntetiden, och studiehjälparna med sitt läge. I
studiehjälparens panel (Översikt) står Utbildningsprovet med läget, försöken och Nollställ provet och Kräv
provet eller Kräv inte provet.

**Frågorna kommer ur Handledarhandboken** (2026-10-20, Leo, med handboken som PDF: "provet ska vara utformat
efter det dokumenten, 55% rätt för godkänd"). 34 frågor med fyra alternativ, i handbokens ordning, lagda med
`supabase/scripts/provets-fragor-ur-handboken.sql`, som inte är en migration och inte registreras. 26 är provet i
ansökan ord för ord (`_delad/utbildningsprov.ts`, borttagen 2026-10-21) och 8 är nya för det som där saknar fråga, med sidan i
handboken i filen. **Fyra av de nya står avstängda**: interleaving, psykisk ohälsa, den aggressiva föräldern och
att dokumentera objektivt. Leo tog bort frågorna om de ämnena ur provet i ansökan 2026-10-02, efter att ha gjort
det själv (`minne/notiser.md`, Utbildningsprovet i ansökan), så bara Leo slår på dem. Provet visar alternativen i den
ordning de står (`mitt_utbildningsprov()` blandar inte), så det rätta står på olika platser, och att alltid välja
det längsta ger 2 rätt av 30.

**Samma kväll blev de 26 lättare frågor** (Leo: "ta bort gamla och ersätt med nya på 26 frågor, 55% rätt släpper
in läxhjälparen i sin vy, provet ska bara göras en gång, vid aktivering av konto ... gör provet relativt lätt"),
med `supabase/scripts/provets-fragor-latta.sql`: samma 26 ämnen som provet i ansökan, kortare frågor, tre
alternativ, det rätta nära handbokens ord och de fel som går emot den. Raderna skrevs över där de stod (ingen hade
gjort provet), och de åtta som blev över står avstängda sist. Det rätta är längst i 8 frågor, kortast i 9 och
mittemellan i 9, och ingen tumregel ger mer än 9 av de 15 rätt som krävs. En fråga ändras i vyn, aldrig i
filerna, och ändras handboken läses frågorna om. Ingen migration lägger in frågor, och inga påhittade frågor
ska in i driften.

## Studiehjälparen utåt och omdömena

En studiehjälpare syns publikt först när admin satt läget till
**Godkänd**.

Ur avsnitt 11:

- **Riktiga foton på studiehjälparna.** Generisk siluett nu.

**Omdömen hittas aldrig på** (2026-09-25). Falska
konsumentrecensioner står på marknadsföringslagens svarta lista sedan
1 september 2022, och den som visar recensioner måste säga om och hur
de kontrolleras. Röster på startsidan var tre tomma platshållare; tills
riktiga omdömen finns står där ett brev undertecknat Leo och
Alexandar, under rubriken "Innan de första omdömena". Vad som gäller
för ett riktigt omdöme står i kommentaren över sektionen i
`index.html`. Google-recensionen frågas efter i studievyn
(`ritaRecension`) så fort `GOOGLE_RECENSION_URL` är satt, och alla
familjer med två rapporter får samma fråga: att bara skicka de nöjda
vidare förbjuder Google. `tutor_reviews` (v7) är omdömen om
studiehjälparen, inte om Nextrum, och ska aldrig bli publik, för
studiehjälparna är ofta sexton. Den har noll rader och ingen vy skriver
dit. Insert-policyn prövade förut bara att passet var familjens, så en
familj kunde skriva om vilken studiehjälpare som helst; sedan Fas 19.3
måste `tutor_id` vara passets studiehjälpare och `student_id` passets
elev.

## Avtal som delas med personen

**Ett avtal delas med personen det gäller** (2026-09-29, Leo: "man ska
kunna spara dokument där och välja vilken person som ska ha tillgång
till det genom sina inställningar. dvs anställningsavtal med lärare
eller annat avtal med kund"). Under System → Dokument väljer admin vem
en handling gäller, en familj eller en studiehjälpare, och om personen
ser den. Personen läser den under **Profil & inställningar → Dokument**
i sin egen vy (`NXStudie.dokument`, samma i båda vyerna) och kan öppna
eller ladda ned filen, men inte ändra något. Personen står i
`kopplad_tabell = 'profiles'` och `kopplad_id`, kolumnerna som fanns
sedan Fas 9.10 utan att någon vy satte dem, och delningen i
`handlingar.delad_med_personen`. En person, inte en lista: ett avtal
har en motpart, och en handbok till alla studiehjälpare är en annan
regel som byggs när den behövs. Tre saker:
- **Personen läser aldrig tabellen.** `handlingar` bär vår
  `anteckning`, och RLS kan inte begränsa kolumner. `mina_handlingar()`
  lämnar ut en fast kolumnlista för den inloggade själv, och hinken
  släpper in exakt den fil raden pekar ut (`intern.handling_delad_med_mig`),
  inte en annan fil i samma mapp.
- **Vyerna är låsta tills de öppnas.** En familj ser ingenting förrän
  den är matchad, och en studiehjälpare förrän hen är godkänd.
  Formuläret säger det när personen väljs; dokumentet syns när vyn
  öppnas.
- **Öppna går i samma tryck** (`NXMedia.öppnaFil`): en PDF eller en bild
  i en ny flik som öppnas innan länken finns, annars stoppar Safari den
  tyst; Word laddas ned. Länken gäller fem minuter, för ett avtal kan
  bära ett personnummer.
Personens panel i adminvyn visar dokumenten under Översikt, med en
länk till formuläret där personen redan är vald. Ingen notis går ut
när något delas (avsnitt 11).

**Ett avtal klistras in som text** (2026-10-05, Leo: "avtalen som
skrivs ska kunna kopplas till användare också, dvs föräldrar vilket
innebör att jag ska kunna klistra in avtal som lagras hos mig och hos
de. avtalet ska kunna namges hur som helst"). Under System → Dokument
väljer admin **Som: Inklistrad text**, och avtalet blir en rad i
`handlingar` med texten i `innehall` (`avtal_som_text`). Titeln är fri
text som förut, och personen ser den som rubrik; sorten är den fasta
listan. Personen trycker **Läs** under Profil & inställningar →
Dokument, texten fälls ut under raden, och **Ladda ned** ger en
textfil med avtalets namn (`NXMedia.sparaText`), samma fil som admin
får från Öppna. Fyra saker:
- **En fil eller en text, aldrig båda** (`handlingar_fil_eller_text`).
  En rad utan fil är en text; så vet vyn vilken knapp den ska rita.
- **Texten ändras aldrig**, inte ens av admin
  (`handlingar_texten_star_fast`). Ett avtal motparten läst får inte
  bli ett annat utan att hen vet det. En ny version är en ny handling,
  och den gamla tas bort för sig. Titeln, sorten, giltigheten och
  delningen går att ändra.
- **Ingen maxlength i rutan.** Webbläsaren kortar en inklistrad text
  tyst vid gränsen, och ett avkortat avtal ser helt ut. Taket (200 000
  tecken) prövas när det sparas, med ett besked, och i databasen.
- **Bara text.** Radbrytningarna står kvar, men inte fetstil, tabeller
  eller bilder; ett avtal som behöver dem laddas upp som PDF.
  Formuläret säger det.
Att avtalet syns i en inloggad vy är inte säkert samma sak som att
familjen fått det på ett **varaktigt medium**, som distansavtalslagen
kräver av bekräftelsen: en sida vi styr och kan ta bort räknas troligen
inte som det (EU-domstolen, Content Services, C-49/11). Ladda ned ger
familjen en egen kopia, men vill vi kunna visa att de fått villkoren ska
avtalet också mejlas. Det är en fråga för juristen, inte för koden.

Driftsättningen och det som är kvar, ur avsnitt 11:

- **Avtal som text (2026-10-05) är i drift.** PR #188 mergades och
  Vercel driftsatte merge-commiten samma kväll. Migrationen
  `avtal_som_text` kördes avsnitt för avsnitt efter merge, som version
  `20261005120000`, och det driften sparade har samma md5 som filen
  (`5145c632…`). Hela `rls-test.sql` från merge-commiten mot driften, i
  en transaktion som rullades tillbaka: 1279 av 1280, alla 13 nya gröna.
  Den röda är 14.6 "familjen väljer faktura på ett genomfört obetalt
  pass": fixturen lägger passet "förra månaden", och september 2026 är
  stängd i driftens bokslut (Fas 20.2), så månadslåset nekar. Det är en
  datumfälla i testfilen, inte ett fel i schemat; lokalt 1280 av 1280.

- **Avtalen som delas med personen (2026-09-29, avsnitt 1) är i drift.**
  Migrationen `dokument_delas_med_personen` kördes efter att PR #126
  mergats, som version `20260929080900`, och det driften sparade har
  samma md5 som filen. Hela `rls-test.sql` gick igenom mot driften
  efteråt: 771 av 773, där de två är Fas 23.1:s prov, som väntar på sin
  egen migration. En databas byggd utan migrationen tål vyerna: System →
  Dokument laddar upp som förut, delningen säger att den inte finns än,
  och Profil → Dokument står tom. Kvar:
  1. **Ingen notis när något delas.** Personen får varken mejl eller
     en rad i vyn; säg till själv. En notistyp är fem steg
     (`DEPLOY-NOTISER.md`) och en driftsättning av `notis-ko`.
  2. **Ingen underskrift.** Dokumentet är en kopia att läsa. Ett avtal
     som ska skrivas under skrivs under någon annanstans, och den
     påskrivna filen läggs upp som en ny handling.
  3. **En person per handling.** Något som ska nå alla studiehjälpare
     (handboken, en policy) är en egen regel, och byggs inte förrän den
     behövs.

## Admin läser chatten

**Admin läser chatten utan att parterna ser det** (2026-09-29, Leo:
"vi på admin ska kunna gå in i elevers och lärares chattar utan att de
ser det. det gör vi från vår admin genom att trycka på öppna chatt").
**Öppna chatt** står på varje tråd under Frågor → Chattar och under
Chatt på familjens och studiehjälparens Översikt, och öppnar hela
tråden i personpanelen (`chatt:<familj>|<studiehjälpare>`), bara för
läsning. Läsrätten fanns sedan schema-v4; det nya är vägen till en hel
tråd och spåret efter den. Tre saker:
- **Osynligt i stunden, aldrig hemligt.** Vyn läser genom
  `chatt_las()` och aldrig genom `NXKontakt.tråd()`, som markerar det
  den visar som läst: vår läsning hade tagit bort "oläst" hos den som
  skrev. Ingen Realtime-kanal, ingen skrivruta, ingen notis. Att vi KAN
  läsa står i integritetspolicyn på båda språken (Vem som kan se vad,
  och 6.1 f under Varför vi får göra det) och i chatten själv ("det som
  sägs här stannar mellan er och oss"). Ta inte bort det: att de inte
  märker när vi läser är lagligt, att de inte vet att vi kan är det
  inte (GDPR art. 5.1 a och 13).
- **Varje öppning står i auditloggen** (`chatt.oppnad`: vem, när,
  familjen som Gäller, studiehjälparen och antalet meddelanden, aldrig
  texten), skriven av funktionen i samma transaktion som läsningen, som
  personnumret (Fas 6.1). Tråden hämtas därför om vid varje öppning och
  aldrig ur panelens cache. Loggen är ett spår, inte ett lås:
  läsrätten på `messages` står kvar för chattlistans senaste rad och
  familjens tidslinje.
- **Syftena i policyn är de vi får läsa för**: barnens trygghet, tonen,
  och att reda ut det som gått fel. Att läsa för att det går täcks inte
  av dem, och en studiehjälpare ska ha fått veta i förväg att chatten
  kan läsas (DATASKYDD.md avsnitt 8).
`chatt_las()` ger de 500 senaste meddelandena, nyast först, och
`totalt`: PostgREST kapar ett svar vid tusen rader, och en tråd hämtad i
tidsordning hade tappat de nyaste. I drift sedan 2026-09-29 (avsnitt
11).

**Barnets egen tråd** (barnets_chatt, 2026-10-06): ett barn med egen
inloggning skriver till sin studiehjälpare i `barn_meddelanden`, en
tabell för sig, och föräldern läser utan att skriva. Admin läser den i
samma Öppna chatt, under rubriken Barnens trådar, genom `barnchatt_las()`,
som loggar `chatt.oppnad` med tabellen `barn_meddelanden`; samma regler
som ovan, och det står i barnets och studiehjälparens ruta att föräldern
och Nextrum kan läsa. Varför och hur: `minne/barnkonton-och-admin.md`.

Driftsättningen och det som är kvar, ur avsnitt 11:

- **Chatten som admin öppnar (2026-09-29, avsnitt 1) är i drift.**
  Migrationen `admin_oppnar_chatten` kördes efter att PR #137 mergats,
  med versionen i filnamnet (`20260929123125`): raden i
  `schema_migrations` skrevs i samma transaktion som migrationen, efter en
  md5-prövning mot filen, så `created_by` är tom på just den, som för
  Fas 23.1. Det driften sparade har samma md5 som filen. Hela
  `rls-test.sql` från main gick igenom mot driften efteråt, 923 av 923,
  också NexLäx (Fas 23.2), som en annan session kört samma eftermiddag
  som `20260929150309` och `20260929150310`. Före merge provades den i en
  transaktion som rullades tillbaka: 873 av 873 med migrationen, och
  utan den föll bara avsnittets egna fem rader. En databas byggd utan
  migrationen tål vyn: Öppna chatt står kvar i listorna, men panelen
  säger att migrationen saknas och läser ingenting, för en läsning utan
  rad i loggen ska inte gå att göra från vyn. Kvar som inte är kod: säg
  till studiehjälparna och familjerna med konto att vi kan läsa chatten
  (DATASKYDD.md avsnitt 8).

## Det sajten lovar om studiehjälparna och formatet (2026-10-06)

- **"Kontrollerade" och "verifierade" studiehjälpare** stod på fyra sidor
  utan att säga vad kontrollen är, och en förälder läser in
  belastningsregister i ordet. Bakgrundskontroller är inte byggda. Sidorna
  säger nu det som sker: intervju, utbildning och ett prov.
  Börjar ni begära utdrag ur belastningsregistret får sidorna säga det.
- **Vem som får söka:** alla som får jobba (Leo, 2026-10-06). Startsidan sa
  "du behöver inte studera för att jobba här", medan Bli studiehjälpare,
  FAQ:n, Vår idé, prissidan, två läxhjälpssidor och kontaktformuläret sa
  gymnasie- och högskolestudenter. Nu säger alla att den som får jobba får
  söka, också den som inte pluggar; under 18 gäller vårdnadshavarens
  godkännande. "Nyligen läst samma kurser" står kvar som det matchningen
  letar efter, och "Av unga, för unga" som namnet på idén. Fältet Skola &
  program i ansökan var aldrig obligatoriskt och säger nu "om du pluggar".
- **Gymnasiet eller äldre** (2026-10-14, Leo): "vi anställer gymnasieelever och uppåt".
  En 13-åring sökte, och inget på sajten sa att det inte gick; nejet fick förklaras i
  efterhand. Nu säger Bli studiehjälpare (båda språken, punkten och FAQ:n), FAQ:n, startsidan
  och juridikagentens bakgrund att man ska ha börjat gymnasiet. Ansökan har ett obligatoriskt
  val, Var är du i skolan just nu? (Grundskolan, Gymnasiet, Universitet eller högskola, Jag har
  gått ut gymnasiet). Grundskolan visar förklaringen och stoppar ansökan i formuläret; databasen
  prövar det inte, så en ansökan som går förbi formuläret sorteras bort för hand. Svaret står
  överst i why som "Skola nu: ...". Den som gått ut gymnasiet behöver fortfarande inte plugga.
- **Hemma eller online:** familjen väljer för varje pass; att ses hemma
  förutsätter att matchningen ger någon som kan ta sig dit varje vecka,
  annars börjar man online. Områdessidorna sa att formatet "avgörs av
  matchningen, inte av adressen", och ämnessidorna att ni väljer.

## Betygsgarantin (2026-10-07)

Leo ville ha en betygsgaranti som Studybuddys, men svårare att få. Den
blev svårare genom villkor som går att räkna, inte genom luddiga
(`anvandarvillkor.html#betygsgaranti`, båda språken).
- **Inget om engagemang.** Förlagan hänger på att eleven "visar intresse"
  och att bolaget bedömer det. Ett villkor som bara vi bedömer gör
  garantin till ett löfte vi själva kan säga nej till: vilseledande
  marknadsföring, och troligen ett oskäligt villkor. Våra läses ur det som
  redan finns: hållen tid, rapporterna, `bookings.attendance =
  'franvarande'`, `homework.status` mot `due_date`, och betalningarna.
- **Årskursens betyg** (Leo samma dag, efter ett varv med 40 och 30
  veckor): betyget som räknas är årskursens sista, det skolan sätter när
  läsåret slutar, i varje årskurs. Texten säger inte bara "slutbetyg", för
  i åk 6-8 heter vårens betyg terminsbetyg och ordet hade uteslutit dem;
  "i åk 9 slutbetyget" lästes som bara nian, så texten säger nu rakt ut
  "varje årskurs, inte bara årskurs 9". Ett terminsbetyg till jul räknas
  inte, och därför är kopiorna betyget före anmälan och det som räknas,
  inte "de två senaste".
- **Inget veckoräknande, men ett golv: 31 december** (Leo). Garantin ska
  vara anmäld och passen ha börjat senast då. Utan golvet börjar någon i
  maj, när betyget i praktiken är satt, köper ett par timmar och får tio.
  Först stod det "före vårterminen", men vårterminen börjar olika dagar
  i olika kommuner och skolor, och det kan ingen databas pröva.
- **Högst tre ämnen per elev och läsår**, två timmar varje skolvecka
  sammanlagt, inte per ämne (Leo: inte sex timmar i veckan), och 10 timmar
  sammanlagt, inte per ämne som inte gick upp (Leo). Går betyget inte upp i
  ett ämne för att familjen fokuserat mer på ett annat av ämnena med
  garanti, gäller garantin inte för det (Leo, med hans ord). En räknebar
  form, under hälften av det största ämnets tid, sa han nej till samma
  dag. Regeln är alltså den enda i garantin som är en bedömning och inte
  går att räkna, och den görs ur rapporternas fritext, så den vilar på att
  studiehjälparen skriver ämnet och tiden när ett pass delas.
- **Andra ämnen påverkar den inte** (Leo): vi hjälper med andra ämnen och
  läxorna i stort som vanligt, och de timmarna räknas bara inte in i de
  två. Därför gäller fokusregeln mellan ämnena med garanti; med "ett annat
  ämne" hade de två meningarna sagt emot varandra, och i ett
  konsumentavtal vinner då den läsning som är bäst för familjen ändå.
- **Hårdare än förlagan:** ämnen som anmäls i förväg och inte byts,
  två timmar varje skolvecka till läsårets slut, missade timmar igen inom
  14 dagar, inga uteblivna pass, 90 procent av uppgifterna i tid, allt
  betalt och ingen faktura sen, en gång per elev och ämne, och 10 timmar
  i stället för 20.
- **30 dagar för anspråket, med flit inte kortare:** betygen sätts före
  sommarlovet, och en kortare frist slår mot den som är bortrest, inte mot
  den som inte gjort jobbet.
- **Anmälan i föräldravyn** (Leo samma dag: "smidigare"), under Profil →
  Betygsgaranti, i stället för ett mejl. Föräldern väljer ämnet och anger
  barnets nuvarande betyg, ett ämne per tryck, och `anmal_betygsgaranti()`
  prövar allt: vuxen och barnets förälder, godkända villkor, öppet 1 juli
  till 31 december svensk tid, ett ämne ur `intern.betygsgaranti_amnen()`,
  betyg F till B, högst tre och samma ämne en gång (med ett lås, så att
  två tryck samtidigt inte blir fyra). Tiden och läsåret sätter databasen;
  läsåret är året det börjar. Ingen inloggad skriver i `betygsgarantier`.
  Föräldern och admin med `anvandare_las` eller `anvandare_redigera`
  läser; studiehjälparen, en annan familj och barnet inte. Elevens panel
  i adminvyn visar anmälningarna.
- **Låst för familjen, bara vi rättar** (Leo samma dag: "spärr, bara vi
  kan ändra den och då står det senast ändrad"). Den som får redigera
  personer rättar ämnet eller betyget i elevens panel (Rätta,
  `andra_betygsgaranti()`), med samma prövningar som anmälan utom datumet,
  och aldrig ett gallrat betyg. Raden får `andrad_at`, som familjen ser
  ("senast ändrad av oss"), och `andrad_av`, som ingen inloggad läser:
  RLS begränsar inte kolumner, så tabellen har kolumnrättigheter, som
  `tjanster`. Ingen väg tar bort en rad.
- **Ämnena har ett eget betyg**, till skillnad från vyns grupper ("NO /
  Fysik / Kemi / Biologi" har inget betyg att jämföra med). Listan står i
  `NX.GARANTI_AMNEN` i `nextrum-app.js` (föräldravyn anmäler och adminvyn
  rättar ur den) och i `intern.betygsgaranti_amnen()`, och de ändras
  tillsammans. Den är en
  funktion och inget villkor på tabellen, så den byts utan drop.
  Programmering togs ur båda 2026-10-07, samma dag som listan kom
  (`20261007150100_programmering_erbjuds_inte`, i drift samma dag och
  `prosrc` prövad mot filen): Nextrum erbjuder det inte, och ingen
  anmälan fanns i ämnet.
- **Betyget i anmälan.** Först skulle vi se betyg bara vid anspråket,
  eftersom policyn lovade att vi aldrig ber om dem; Leo valde samma dag
  att föräldern anger det vid anmälan. Policyn och registret (rad 25)
  säger det nu. Betyget gallras den 1 oktober efter läsåret
  (`betygsgaranti-gallring`, 03.56 UTC) och direkt när barnet raderas
  eller avidentifieras (`students_betygsgarantier_raderas`); raden står
  kvar utan betyg, för en garanti används en gång per elev och ämne. Vid
  anspråket gäller kopian, inte det föräldern angav. Kopiorna kommer med
  e-post till info@, som ligger i Google Workspace, och raderas för hand.
- **Timmar, aldrig pengar**, som tipstimmen.
- **Passen har inget ämnesfält.** Ämnet läses ur rapportens fritext; ett
  fält på passet vore en egen ändring. Studiehjälparen ser inte heller
  vilka ämnen som har garanti; familjen får säga det.
- **Sidorna säljer den** (Leo samma dag: "sälj in det utan konkreta villkor
  eller siffror", och sedan "effektivt, inte överdrivet"). I dag (2026-10-08):
  på startsidan och Vår idé en platt remsa under Hur hjälper vi ditt barn
  (`.hj-gar`, meningen, stegen 01–04 och "Villkor gäller." med länken till
  villkoren); på prissidan ingen sektion (Leo: "öndödigt stor"), bara raden
  "Betygsgaranti, utan extra kostnad (villkor gäller)" i 399-kortet och
  länken "Läs mer om betygsgarantin" till villkoren under dess knapp
  (`minne/vyerna.md`, Prissidan utan garantisektion). Förut, som historik:
  en sektion på startsidan efter Så fungerar Nextrum och på prissidan efter
  priskorten (2026-10-07 på papperet som ett flöde, inte mörk: Leo
  ville ha "samma färg som resten av sidan", "inte samma kolumner som
  finns överallt" och "en mindre sektion" som "följer ett flow när man
  scrollar"; fyra steg med stora siffror och en linje som fylls i lera,
  och länken till villkoren och raden "Villkor gäller" intill knappen,
  aldrig bakom en utfällning). Dessutom
  en punkt i startsidans sista ruta, prissidans och FAQ-sidans
  beskrivning, och samma fråga i prissidans FAQ och på `/faq`, som
  maskoten och FAQ-schemat därför också svarar med. Inga villkor och inga
  tal, men aldrig ett löfte om ett betyg (avsnitt 8 i kärnan): garantin
  lovar vad vi gör om betyget inte går upp. Varje ställe länkar till
  villkoren eller till ett ställe som gör det och säger att de gäller, för
  en garanti som säljs utan att det syns att den har villkor är
  vilseledande. Undantaget är sista dagen, 31 december, i FAQ-svaren: den
  som missar den har ingen garanti, och det ska inte stå bara i
  villkoren. Hero är orörd, och startsidans beskrivning likaså (den är
  redan vid gränsen för vad sökmotorerna visar).
- **Versionen byttes** (`betygsgarantin`), så alla får frågan igen.
  Inget var byggt för att pröva ett anspråk förrän 2026-10-15 (nedan).
  `rls-test.sql` avsnitt 24 prövar anmälan, läsrätten, gallringen och
  raderingen (1490 av 1490 lokalt, och mot driften när migrationen
  kördes efter merge av PR #212 samma dag; `minne/databasen.md`).

### Prövningen av ett anspråk (2026-10-15, `betygsgarantin_provas`)

Leo 2026-10-15: "bygg det du kunde bygga själv", där prövningen var en av
fyra saker. Villkoren säger att vi prövar "bara det som står här, ur det
som står i er vy: hållen tid, rapporterna, uteblivna pass, uppgifterna och
betalningarna", och att vi inte bedömer engagemang. Underlaget gör just
det, och inget mer.

- **`betygsgaranti_underlag(elev, läsår)`**, bara superadmin, räknar när
  den frågas och sparar inget. Perioden börjar med det första passet efter
  anmälan i något av ämnena och slutar i dag eller den 30 juni. För varje
  ämne: betyget vid anmälan, första passet och om det kom senast den 31
  december, hållen tid och pass, och uppgifterna med passerat slutdatum som
  var klara i tid (`completed_at`, minst 90 procent). Veckorna: hållen tid
  i garantiämnena, oklart och andra ämnen för sig, under två timmar, och om
  underskottet togs igen med överskottet de två veckorna efter. Sist oklara
  ämnen, pass utan tider (räknas med bokad längd), uteblivna pass, avbokade
  pass med vem som avbokade, obetalda pass (samma regel som avvikelsen Inte
  betalt, ur `avvikelser_rader()`) och familjens fakturor som betalades
  efter förfallodagen eller inte är betalda. Fakturans `betald_at` är dagen
  admin markerade den, inte bankens.
- **Ämnet är rapportens.** En rapport räknas när ämnet är ett av
  garantiämnena (utan hänsyn till stora bokstäver). Saknas ämnet, eller är
  det bokningens grupp där ett garantiämne står ("NO / Fysik / Kemi /
  Biologi"), är det oklart och räknas inte förrän vi bestämt. Därför ser
  studiehjälparen vilka ämnen eleven har garanti i, men aldrig betyget
  (`mina_elevers_garantiamnen()`, det här läsåret, `is_my_student`):
  elevprofilen säger det, garantiämnena står först i rapportens ämnesval,
  och en rad över valet säger om passet räknas. Det står i
  `DATASKYDD.md` rad 25 och i policyn på båda språken.
- **Bedöms av er**, i elevens panel: slutbetyget ur kopian mot betyget vid
  anmälan, lovveckorna och skolavslutningen, en vecka med för lite som vi
  eller studiehjälparen avbokade (då räcker det att familjen tog den nya
  tiden), om ett ämne inte gick upp för att tiden lades på ett annat
  garantiämne, de oklara passen, och att anspråket kom inom 30 dagar och
  att garantin inte redan använts.
- **Inte byggt:** anspråken sparas inte (svaret, ämnena, att garantin
  använts), och de 10 timmarna har ingen egen väg. Gratistimmarna
  (`ge_gratistimmar`) gäller 60 dagar och hela familjen, villkoren lovar
  sex månader och eleven.
- **Prov.** `rls-test.sql` avsnitt 37 (12 prov, ett påhittat läsår
  2025/26), `prova-barnkonton.js` (underlaget i panelen, ingen prövning
  för en admin med behörigheter) och `prova-forhandsvisning.js` (raden i
  rapporten och elevprofilen).
- **I drift sedan natten till 2026-10-16**, efter merge av PR #287
  (0c30568), med nivåerna i adminvyn. Hur den kördes och provades står i
  `minne/databasen.md`.

## Tipsa en familj och affischerna (2026-09-30)

Leo 2026-09-30, ur analysen samma dag: en värvningslänk för familjer och
studiehjälpare, belönad med en bjuden timme till familjen och inga pengar
till tonåringen (punkt 5), och affischer med QR-kod på några ställen nära
skolorna (punkt 7). Migrationen `tipskoder_och_kampanjkoder`.

- **En kod, två sorter.** `tipskoder` har en rad per kod: `familj` och
  `studiehjalpare` hör till en person och skapas av `mina_tips()` första
  gången personen öppnar Profil → Tipsa en familj; `kampanj` har ett namn
  och skapas av admin under Tjänster & priser → Tips och kampanjer (fram till
  2026-10-06 under Intresseanmälningar).
  `leads.kod` pekar på raden (främmande nyckel, on delete set null).
  Personkoden är sex tecken utan I, O, 0 och 1, slumpad och utan namn:
  den delas öppet.
- **Koden syns, den lagras inte.** Länken och QR-koden går direkt till
  intresseanmälan med `?kod=`, och formuläret fyller i ett synligt fält
  som familjen kan tömma. Ingen sessionStorage: källspårningen kräver
  samtycke, och rutan är av. Därför går affischens QR-kod till
  formuläret och inte till områdessidan, där en sida hade behövt minnas
  koden åt nästa.
- **En okänd kod fäller aldrig en anmälan.** `intern.leads_tipskod()` gör
  om en okänd eller avstängd kod till null innan främmande nyckeln
  prövas. En kod tas aldrig bort, den stängs av (`aktiv`).
- **Tipstimmen är prissidans första timme med en annan märkning**:
  `startrabatt = true` och en timme i `rabatt_ore`, plus `rabattkod =
  'TIPS'`. Allt som redan vet att ett pass med första timmen bjuden inte
  betalas med köpta timmar eller timbanken, att noll kronor inte är
  obetalt och hur priset visas, gäller då utan ändring. `bookings.rabattkod`
  pekar på `rabattkoder`, så raden `TIPS` finns där, och
  `rabattkoder_tips_aldrig_aktiv` hindrar att den slås på: då hade en
  familj kunnat skriva in den. `skydda_rabatt` skyddar kolumnen redan.
- **Regeln** står i `forsta_timmen_bjuds` och `intern.tipstimmar_*`: en
  timme per familj som anmält sig med familjens kod och haft två timmar
  läxhjälp i hållna pass (genomförda med rapport, eleven inte frånvarande;
  `intern.tva_timmar_hallna`, passens bokade längd). Sedan 2026-10-09;
  förut det första passet. Leo: "man kan tjäna en gratis timme genom att
  ta in en annan familj och detta funkar om den andra familjen haft en
  lektion på två timmar med oss, oavsett om de betalade för båda timmarna
  eller bara en". Adminens kodlista (`tipskoder_lage`, kolumnen
  `forsta_pass`, som heter så för att en ny returtyp hade krävt en drop)
  räknar samma sak och heter Två timmar i vyn. Tipstimmen står utanför
  taket för första timmen (Leo: "utan tips"). Familjen måste
  ha varit ny, utan hållet pass före anmälan, annars hade ett syskons
  anmälan med en väns kod gett en timme. Bara familjens FÖRSTA anmälan
  med en kod räknas. Prissidans första timme går först; tipstimmen dras
  på nästa läxhjälpspass familjen föreslår, en per pass, också när
  familjen skrivit en rabattkod (som då tas bort, 2026-10-13; förut sköt
  koden timmen till ett senare pass), och kommer tillbaka när passet
  avbokas eller avslås. Sedan 2026-10-13 gäller den i 60 dagar från dagen
  den nya familjen haft sina två timmar, för ett pass inom dem
  (`intern.tipstimmar_kvar`, `minne/timmar.md`). Den räknas ur raderna och
  sparas inte.
- **Ingen ersättning till studiehjälpare**, med flit: de är ofta sexton,
  en belöning för att värva kunder är lön, och anställningsformen är inte
  avgjord. Gällde till 2026-10-13: sedan dess gäller studiehjälparens kod
  jobbansökan och ger bonus i lönen (nästa avsnitt).
- **Flaggan `tipstimme`** stänger av erbjudandet. Det som tjänats in innan
  ges ändå, för villkoren (`#tips`) lovar det: gränsen är flaggans
  `uppdaterad`, som `stampla_flaggan` sätter och bara en ändring av
  `aktiv` flyttar. Stängs den av ska villkoren ändras i samma veva.
- **Den som tipsat ser antal, aldrig vilka** (`mina_tips()`): anmälda,
  kunder och familjens timmar. Det står under kodfältet, i villkoren och
  i integritetspolicyn på båda språken, och i DATASKYDD.md rad 19.
- **En raderad person har ingen kod.** `profiles_tipskod_raderas` tar
  bort koden när `raderad_at` sätts (en egen trigger, inte en lapp i
  `radera_person`, som flera sessioner skriver om), och vid en hel
  radering följer den med genom nycklarna. Anmälningarna tappar då
  koden. En anmälan som avidentifieras behåller den.
- **Adminvyn**: "Tipsad av …" i anmälans panel (`dpKod`), listan med
  anmälda, kunder och första pass (`tipskoder_lage()`, bara admin), och
  strömbrytaren under Betalningar → Inställningar. `TIPS` visas inte
  bland rabattkoderna, och ett pass på noll kronor med tipstimmen heter
  "Timme bjuden för tips" i Betalningar.
- **Affischen** (`/affisch?kod=&omrade=`, `nextrum-affisch.js`) är en A4
  med QR-kod till intresseanmälan med koden och
  `utm_source=affisch&utm_medium=qr`, och åtta rivlappar som slutar 7 mm
  från kanten, där skrivaren lämnar tomt. QR-kodaren är
  `bibliotek/qrcode-generator-1.4.4.js` (MIT), vendorad som supabase-js.
  Sidan är `noindex`, bara på svenska och tar ingen fritext ur adressen:
  koden prövas mot samma form som i databasen och området ur en fast
  lista, annars hade vem som helst kunnat skriva ut en affisch med vår
  logga. Raden om vecka 45 försvinner efter `UPPSTART`. QR-koden lästes
  av med OpenCV ur en skärmbild i provet. Planen står i
  `AFFISCHKAMPANJ.md`.
- **Provat** lokalt: 1009 av 1009 i `rls-test.sql`; utan migrationen
  faller de elva nya raderna och inga andra. Vyerna tål att den saknas:
  fliken står tyst och adminlistan säger att migrationen saknas.
- **I drift sedan 2026-09-30.** Migrationen kördes efter att PR #157
  mergats, med versionen i filnamnet (`20260930190000`): databasen
  hämtade filen från merge-commiten med tillägget `http`, prövade md5,
  körde den och skrev raden i `schema_migrations` i samma transaktion, så
  `created_by` är tom, och tillägget togs bort igen. Det driften sparade
  har samma md5 som filen. Hela `rls-test.sql` från merge-commiten gick
  igenom mot driften före, i en transaktion som rullades tillbaka med
  migrationen inläst, och efter: 1009 av 1009. Säkerhetsadvisorn fick två
  väntade rader till, `mina_tips` och `tipskoder_lage` (`minne/sakerhet.md`).
  Flaggan `tipstimme` står på, och ingen kod fanns när migrationen kördes.

## Koderna per formulär, bonusen och tipstimmen i timbanken (2026-10-13)

Leo 2026-10-13: "i admin vyn ska du skapa en ny spalt, där ska koder synas,
allas personliga kod ska synas där. först när jag klicka på koder så ska jag
klickar om jag vill kolla på familjer eller studiehjälpare. när jag har valt
ska koderna synas samt att hur många som använt personens kod. blivande
läxhjälpare ska bara kunna använda befintliga läxhjälp[ares koder], när det
sker och vi tagit in de nya anställda ska den persons kod de använt få en
extra bonus på 300kr, betalas ut som lön. nya familjerna som använder
befintliga familjers koder i sin intresseanmälan, när och om de nya
familjerna tas in i systemet och har haft två timmar i lektion, oavsett om
första var gratis eller inte, så ska familjen med koden få antingen en gratis
lektion eller voucher på x antal kronor, men sätt voucher på en gratis timme
som läggs in i timbanken. vi kan komma att ändra det. gör det snyggt. koder
ska kunna skrivas in i intresseanmälning och jobbansökan och ansökning ska
inte kunna använda koder från familjer och familjer ska inte använda koder
från anställda." Strax efter: "timmarna läggs in i timbanken för familjerna
och bonus redovisas som lön". Migrationen `tipskoder_bonus_och_timbanken`.

- **Koden gäller sitt formulär.** En familjs kod och en kampanjkod gäller
  intresseanmälan (`intern.leads_tipskod`), en godkänd studiehjälpares kod
  jobbansökan (`applications.kod`, `intern.ansokan_tipskod`, triggern
  `applications_tipskod` efter `applications_skydda`). Fel sort blir null,
  som en okänd kod, så en anmälan eller ansökan fälls aldrig av en kod; admin
  som rättar in fel sort får 23514. Studiehjälparens godkännande läses
  direkt i `tutor_profiles`, för `ar_godkand_studiehjalpare()` svarar nej
  för en anonym anropare. Ingen anmälan i driften bar en studiehjälpares kod
  när det byggdes. Formulären säger vilken kod som gäller under fältet, och
  jobbansökan fyller i fältet ur `?kod=` som intresseanmälan (reserven när
  kolumnen saknas skriver koden i `why`, `KOLUMN_I_WHY`).
- **Familjens timme står i timbanken.** Regeln för när den tjänas in är
  densamma (två timmar, 2026-10-09), och den räknas ur raderna som förut.
  Hur den används är `gratistimmarna_60_dagar`s (Leo samma dag: "gratis
  timmar går ut efter 60 dagar att de läggs in", "gratis timmar går ut först
  sen planerna"): den gäller i 60 dagar från den dagen och dras först, som
  ett avdrag på nästa läxhjälpspass (`forsta_timmen_bjuds`,
  `intern.tipstimmar_kvar`). Den här grenen drog den först sist och lät den
  aldrig gå ut; det ströks när main fått regeln, före merge. Studievyn visar
  den som ett kort i Er timbank och under Profil → Timbanken (Timmar för
  tips, med sista dagen ur `mina_tips().kvar_till` och passen den använts
  till).
- **Varför inte en rad i `klippkort`.** Det hade gjort timmen till ett köp:
  0 kr i Köpta timmar, i ångerrätten, i uppsägningen och i Stripes
  avstämning, och `begart_ore > 0` och sorten hade fått släppas med en drop.
  En timme som minuter i timbanken hade betalats tillbaka som pengar när
  familjen slutar, och tipstimmen är aldrig pengar. Rabatten på passet var
  redan provad och i drift; den flyttade bara sist i ordningen.
- **Bonusen är lön.** 300 kr (`intern.tipsbonus_ore()`) till studiehjälparen
  vars kod den nya sökte med, när vi tar in hen: triggern
  `tutor_profiles_tipsbonus` när `tutor_profiles.status` blir `approved`
  (Utbildning hållen gör det, och studiehjälparens läge i adminvyn). Ansökan hittas på adressen,
  som allt annat som kopplar en ansökan till ett konto: den första ansökan
  med en studiehjälpares kod från samma adress, som inte är avböjd. Den nya
  ska vara ny när hen sökte: aldrig godkänd i poolen före ansökan
  (auditloggen) och inget hållet pass. En bonus per ny studiehjälpare och per
  ansökan, aldrig för den egna koden, och bara med flaggan `tipsbonus` på
  när personen tas in.
- **LAGRAD, inte räknad.** Tipstimmen räknas ur raderna, men en lön som är
  godkänd, inläst i Fortnox och betald får inte ändra sig för att en ansökan
  gallrats. `tipsbonus` har en rad per bonus med lönemånaden (`period`,
  månaden den tjänades in), läget (Utkast, Godkänd, Utbetald, Struken) och
  stämplarna. Ingen insert- eller delete-policy; admin ändrar bara läget
  (`intern.tipsbonus_skydda` fryser resten och sätter stämplarna), och
  nycklarna till ansökan och den nya får bli null när de tas bort.
- **Inte i `payouts`.** En rad i `payout_lines` kräver minuter
  (`minuter > 0`), underlaget skrivs bara av månadskörningen, och
  `las_utbetalningsbelopp` fryser beloppet för alla med en token. Bonusen
  står därför för sig: Löner räknar den i Att betala ut och i Månadens
  ekonomi (`lönFörMånad`), har rutan Bonus för tips med lägena, och
  lönefilen tar den godkända som en egen lönetransaktion, antal 1, på
  lönearten `foretagsfakta.lonart_tipsbonus` (`minne/betalning.md`).
  Studiehjälparens lön visar den under månaden och på lönespecen.
- **Koder i adminvyn** (`#koder`, `nextrum-admin-koder.js`, bara
  superadmin): först valet Familjer eller Studiehjälpare (två kort), sedan
  allas kod med nyckeltal, regeln med strömbrytaren, filter, sök och en rad
  per person som fälls ut och visar vilka som använt koden, med länk till
  anmälan eller ansökan och bonusens läge. `koder_lage(p_sort)` skapar de
  koder som saknas (`intern.ny_tipskod`, samma form som `mina_tips`), men
  aldrig åt ett adminkonto, som ofta har rollen parent. Hämtas när sektionen
  öppnas, inte vid start. Tips och kampanjer under Tjänster & priser visar
  bara kampanjkoderna sedan dess.
- **Studiehjälparens flik heter Tipsa en studiehjälpare**: länken går till
  `/bli-studiehjalpare?kod=…#ansok`, och rutan säger antal sökande och
  intagna och bonusen. Familjens flik säger timmen i timbanken.
- **Raderingen**: en studiehjälpare med en bonus som inte är utbetald eller
  struken raderas inte (hindret `tipsbonus`), och en med en bonus alls
  avidentifieras i stället för att tas bort; bonusen står under Står kvar.
- **Villkoren** (#tips, båda språken) och policyn säger det; versionen är
  2026-10-13. Rad 19 och 27 i `DATASKYDD.md`.
- **Vad Leo kan ändra**: "vi kan komma att ändra det" om familjens
  belöning. En timme är `startrabatt` på ett pass; en voucher i kronor finns
  inte i betalningen och vore en egen ändring (ett tillgodohavande som
  kassan och fakturan drar av). Antalet timmar och bonusens belopp ändras
  med en migration och villkoren samtidigt.
- **Provat** lokalt: 1542 av 1542 i `rls-test.sql`, med avsnittet KB (23
  nya prov) och tipsavsnittet omskrivet för ordningen.
- **I drift 2026-10-13 kväll**: PR #269 mergades (28a0e8a) och migrationen
  kördes efter `gratistimmarna_60_dagar`, med filens md5, och `drift` v17
  säger regeln för agenten. Hela `rls-test.sql` 1643 av 1643 mot driften,
  tillbakarullat (`minne/databasen.md`, Körda i driften). Ingen bonus och
  ingen kod för en studiehjälpare i en ansökan fanns då.

## Värvningsbonusen (2026-10-21, `varvningsbonus`, inte i drift)

Leo: "en studiehjälpare som värvar en kompis får en bonus på 300 kr brutto,
inklusive semesterersättning, när kompisen har fått sitt
studiehjälparkonto. Systemet betalar INGENTING ut. Det registrerar och
visar bonusen som underlag för Leos utbetalning." Migrationen
20261021215000; ordningen i driften i `DEPLOY-BETALNING.md` 9.24.

- **Byggd på det som fanns, inte bredvid.** Studiehjälparens tipskod gällde
  redan jobbansökan, och den vars kod en ny studiehjälpare sökte med fick
  300 kr i lönen (`tipsbonus`, 2026-10-13). En andra tabell för samma bonus
  hade gett två bonusar för samma kompis. Därför är värvningskoden
  tipskoden (sorten `studiehjalpare` är beställningens "typ varvning"),
  `applications.kod` är beställningens `varvad_av_kod_id` (koden är
  tabellens nyckel), och `varvningsbonus` tar över bonusen: `tipsbonus` får
  inga nya rader, och det som står där flyttas hit med `tipsbonus_id` (utkast
  och godkänd blir intjänad, utbetald står kvar med lönemånaden, struken
  blir annullerad med skälet "Struken under Löner före 2026-10-21").
- **Koden skapas av sig själv** när någon blir godkänd i poolen
  (`intern.tipsbonus_vid_intag`, men aldrig åt ett adminkonto), och
  migrationen ger varje godkänd studiehjälpare en. En ny kod har åtta
  tecken ur `gen_random_bytes` (32 tecken, ungefär 10^12 möjliga); de
  gamla på sex står kvar, för de kan redan stå på en affisch eller i ett
  meddelande. Koden gäller bara medan ägaren är godkänd och kontot inte
  raderat: "inaktiverat konto betyder inaktiv kod".
- **Formuläret** (`bli-studiehjalpare`, båda språken): fältet Kod från en
  studiehjälpare tar också `?kod=`, och `NX.provaJobbkod` frågar
  `prova_jobbkod()` när fältet ändras: gäller (Koden gäller), finns inte
  (beskedet under fältet, och fältet töms när ansökan skickas, med en mening
  i tacket) eller för många försök (koden följer med, och databasen prövar
  den). Svaret säger aldrig vems koden är, och en okänd kod räknas mot ett
  tak, tio i timmen per IP-nummer som en HMAC i ett dygn (samma tabell som
  rabattkodernas försök, med nyckeln `jobbkod:`), och högst 500 okända i
  timmen totalt. IP-numret är Cloudflares `cf-connecting-ip`, och bara utan
  den det första i `x-forwarded-for` eller `x-real-ip` (granskningen
  2026-10-21: det första värdet i `x-forwarded-for` sätter klienten själv;
  barninloggningens räknare läser det fortfarande, och det är äldre än
  grenen). Taket är ett hinder, inget skydd. En kod som inte gäller fäller
  aldrig ansökan.
- **Kopplingen på ansökan** sätter databasen (`intern.ansokan_tipskod`):
  koden prövas (finns, sorten studiehjälpare, aktiv, ägaren godkänd och
  inte raderad), och `varvad_av_profil_id` blir ägaren. En klient kan inte
  ändra någon av dem efteråt (42501); admin kan rätta koden, och värvaren
  följer den (att sätta en annan värvare än kodens ägare är 23514).
- **Raden** skrivs när ansökan kommer in (`applications_varvning`, AFTER
  INSERT och när värvaren ändras): `vantar`, eller `annullerad` med skälet
  när den som söker inte är ny: sin egen kod ("Egen kod: den som sökte äger
  koden"), en tidigare ansökan med samma adress ("Har sökt förut") eller ett
  konto med adressen som fanns före ansökan ("Hade redan ett konto"). En
  annullerad rad skrivs med flit i stället för ingen: den visar admin varför,
  och den håller personens HMAC så att samma person aldrig ger en bonus
  senare. Unikt per ansökan, per konto och per person (HMAC av adressen över
  alla bonusar, `intern.varvning_epost_hmac`).
- **Intjänandet** (`intern.varvning_prova`, under radlås): kontot är det som
  kopplats, annars ansökans `konto_id` (Utbildning hållen), annars en
  studiehjälpare med ansökans adress. Är kontot värvarens eget annulleras
  den; har kontot redan gett en bonus annulleras den. Sedan händelsen i
  `varvning_installning.utlosare`: `konto_skapat` (förvalet, fullt byggt:
  kontot är godkänt i poolen eller kopplat till ansökan), `prov_godkant`
  (`prov_studiehjalpare.utbildningsprov_godkant_at`) eller
  `forsta_pass_genomfort` (en rapport med ett pass). Har den inträffat, och
  värvaren är godkänd och flaggan `tipsbonus` på, blir raden `intjanad` med
  delningen och händelsen; annars annulleras den med skälet. Triggrarna som
  prövar sitter på `tutor_profiles` (godkänd), `applications.konto_id`,
  `prov_studiehjalpare` och `lesson_reports`. Bara en rad i `vantar` ändras,
  så samma händelse två gånger ger en bonus.
- **Beloppet**: bruttot fryses när raden skrivs (`brutto_ore`), procenten och
  delningen när den tjänas in: grund `round(brutto / (1 + procent/100))`,
  semester resten, så att summan alltid är bruttot (26 786 + 3 214 = 30 000
  öre). En ändring i `varvning_installning` rör aldrig en intjänad rad, och
  en väntande behåller sitt brutto (det som visades när kompisen sökte).
- **Lägena** går bara framåt (`intern.varvningsbonus_vakt`): `vantar` till
  `intjanad` eller `annullerad`, `intjanad` till `utbetald` (med lönemånaden
  ÅÅÅÅ-MM) eller `annullerad` (med ett skäl), och `utbetald` och `annullerad`
  är slutliga. Delningen, bruttot, värvaren och ansökan står fast; bara
  nycklarna till ansökan och den värvade får bli null när de tas bort. Raden
  raderas aldrig (delete och truncate nekas), och auditloggen får läget,
  beloppen, lönemånaden och vem, aldrig skälet.
- **Admin** (sektionen Värvningsbonus, `nextrum-admin-varvning.js`, bara
  superadmin): inställningen överst, Väntar, Intjänade och Utbetalt, filter
  på läge och månad, en rad per bonus med värvare, värvad, belopp och
  delning, läge och datum, Markera utbetald (en eller alla intjänade som
  syns; lönemånaden krävs och föreslås som månaden den tjänades in),
  Annullera (skälet krävs, minst tre tecken), summeringen per värvare och
  lönemånad och CSV för revisorn och lönen (semikolon, decimalkomma, ören
  och skälet). Knapparna går bara genom `varvningsbonus_utbetald()` och
  `varvningsbonus_annullera()`. Under Löner står månadens bonusar i samma
  ruta som förut, med samma knappar; Godkänd finns inte längre, så den
  intjänade kommer med i lönefilen, och det som inte ska betalas annulleras.
- **Värvaren** (Profil → Värva en kompis, `nextrum-studie.js`): koden,
  länken till `/bli-studiehjalpare?kod=…#ansok`, beloppet och händelsen ur
  inställningen ("300 kr inklusive semesterersättning när din kompis har
  fått sitt konto"), och en rad per kompis med bara läget, förnamnet först
  när kontot finns, och för en intjänad eller utbetald bonus dagen den
  tjänades in eller lönemånaden (`mina_tips()`, som aldrig lämnar ut
  ansökan, när kompisen sökte, adressen eller kontot och aldrig de
  annullerade; dagarna räknas i Stockholms tid i databasen). Villkoren är
  punkten `#tips`, omskriven för bonusen i versionen 2026-10-22 (Leo: "Fixa nr
  6"), och kortet länkar dit (`CFG.VARVNING_VILLKOR_URL`). Under
  Statistik → Ersättning står månadens intjänade bonus, och lönespecen
  kallar den värvningsbonus.
- **Mejlet** (`varvningsbonus`, `minne/notiser.md`): till värvaren när
  bonusen tjänas in, bara beloppet och att den hanteras enligt villkoren.
- **Raderingen**: en värvare med en intjänad bonus som inte är utbetald
  raderas inte (hindret `varvningsbonus`), och en med en rad alls
  avidentifieras i stället (raden är lön). Den värvade raderas som förut;
  raden tappar kontot och ansökan och behåller HMAC:en.
- **Byts händelsen** i `varvning_installning` prövas alla väntande rader
  mot den nya direkt (`varvning_installning_andrad`), i stället för först när
  något händer kompisen igen; bruttot på en väntande rad står fast.
- **Inte byggt, med flit**: ingen utbetalning och ingen Stripe; och villkoren
  `#tips` säger fortfarande "när vi tar in" och att den som tipsat inte ser
  vilka (Leo skriver bonusvillkoren och `#tips` om i samma version).
- **Provat** lokalt: `rls-test.sql` (avsnitt KB omskrivet för
  `varvningsbonus` och avsnitt 52, VB, med 21 prov), `prova-varvning.js`
  57 av 57, `prova-adminvyn.js` mot en riktig databas och `prova-koder.js`
  (`minne/genererat-och-ci.md`).
- **Granskningen 2026-10-21** (två granskare, oberoende av varandra, hittade
  samma fel och bevisade det mot en lokal databas). Bonusen gick till den
  som FÖRST skickat en ansökan med en adress: indexet på HMAC:en gällde alla
  lägen, en senare ansökan från samma adress fick ingen rad, och kontot
  hittade bonusen på adressen. Vem som helst med en giltig kod kunde alltså
  skicka en ansökan med en kompis adress och ta kompisens värvning, också
  när den ansökan avböjdes. Rättat:
  - **Bonusen följer ansökan som blev kontot** (`applications.konto_id`;
    adressen bara när ingen ansökan har kontot). `varvning_prova` prövar i
    ordning: ansökan finns, en annan ansökan från samma person blev kontot,
    ansökan avböjdes, egen kod (kontot är värvarens eget, också på adressen),
    kontot fanns före ansökan, personen har sökt förut, personen har redan
    gett en bonus; först sedan händelsen. Att personen är ny prövas alltså
    igen när bonusen tjänas in (förut bara när ansökan kom, mot den adress
    den hade då; admin som rättade adressen till ett gammalt konto gav en
    bonus för ett konto från i våras).
  - **En väntande rad annulleras med skälet** när ansökan avböjs, gallras
    eller tas bort ("Ansökan gallrades eller togs bort innan bonusen
    tjänades in"), när en annan ansökan från samma person blir kontot, och
    när admin tar bort eller byter koden ("Koden togs bort ur ansökan",
    "Koden i ansökan byttes"; triggern går på `update of kod,
    varvad_av_profil_id`, för en `UPDATE OF`-trigger ser bara kolumnerna i
    själva satsen, och värvaren sätts av en BEFORE-trigger), och den nya
    värvaren får en ny rad. När bonusen tjänats in står koden fast (23514).
  - **Unikheten gäller bara levande rader**: en per ansökan och en per konto
    som inte är annullerad, och en intjänad eller utbetald per person. En
    annullerad rad håller inte längre en adress, så ingen kan låsa en annans
    adress med en falsk ansökan.
  - **En rad skapas bara som `vantar` eller `annullerad`**
    (`varvningsbonus_ny`; förut bara en BEFORE UPDATE-vakt, så en
    edge-funktion med tjänstekontot kunde skriva en intjänad rad direkt), och
    tjänstekontot har inga skrivrättigheter i `varvningsbonus` eller
    `varvning_installning`.
  - **Personen** är en HMAC av `intern.varvning_epost_nyckel`: gemener, utan
    +tagg, och för Gmail utan punkter och med googlemail.com som gmail.com,
    för där är kim.kompis och kimkompis samma brevlåda.
  - `mina_tips()` visar inte en väntande rad vars ansökan avböjts, och
    adminvyns CSV sätter en apostrof före ett värde som börjar med `=`, `+`,
    `-`, `@`, tabb eller CR (ett namn ur en anonym ansökan hade annars blivit
    en formel i Excel). Datumen i sektionen och lönefilen är Stockholms
    (`sthlmDag`).
  - Provat: `rls-test.sql` avsnitt 52 (`VB`, tio prov till) och KB.

---

### Ordlistan (använd den, i kod och i text)

| Ord | Betyder |
|---|---|
| studiehjälpare | den som håller passet. Aldrig "lärare" utåt — `larare.html` heter så av historiska skäl. "Privatlärare" står en gång, i FAQ:n, för att säga att en studiehjälpare INTE är det (2026-09-28): ordet är det konkurrenterna och föräldrarna söker på, och svaret är ärligare än att tiga |
| pass | ett bokat tillfälle (`bookings`). Hela timmar, 1–3 |
| rapport | `lesson_reports`. **Passet är genomfört först när rapporten finns** |
| underlag | vad studiehjälparen ska få (`payouts`) |
| betalning | vad familjen betalat för ett pass: med kort, per pass, i förväg eller efter passet när rapporten bekräftas, eller med timmar ur timbanken (`bookings.betalning_status`, `betalt_ore`). Mot faktura gick det från Fas 14.6 till 2026-10-21, då fakturan togs bort |
| tjänst | rad i `tjanster`. `aktiv` avgör vad som syns, inget annat |
| uppgift | i studievyn (under NexLäx) och studiehjälparvyn det eleven ska göra mellan passen (`homework`, Fas 23.1). Hette läxa. I adminvyn och i tabellen `uppgifter` betyder ordet fortfarande adminens att göra-lista; koden för elevens uppgifter säger `laxor` och `homework` |
| nivå | en digital uppgift i banan (`nivaer`): 5–12 frågor som rättas i databasen. En **bana** är nivåerna i ett ämne och en årskurs. Ett **Mästarprov** och **repetitionen** är nivåer som drar sina frågor ur banan (Fas 23.2) |
| NexLäx | studievyns sektion för banan, det studiehjälparen gett och utvecklingen (Fas 23.2). Ersatte Uppgifter och Min utveckling. I koden `nexlax` och `NXUppgifter` |
| motförslag | en annan tid som svar på ett förslag: samma pass, flyttat, med `motforslag_at` (2026-09-30). Besvaras med ja eller nej. Ett avslag är `cancelled` med studiehjälparens svar i `svar_meddelande` |
| XP | poäng som räknas ur svaren och försöken och aldrig sparas (Fas 23.2, reglerna i `intern.nexlax_*`) |
| tipskod | en familjs egen kod i intresseanmälan, eller en studiehjälpares i jobbansökan (`tipskoder`, 2026-09-30; per formulär sedan 2026-10-13); en kampanjkod är en affischs |
| tipstimme | en timme i timbanken för ett tips (sedan 2026-10-13), dragen sist: `startrabatt` och `rabattkod = 'TIPS'` på passet |
| värvningsbonus | 300 kr brutto, inklusive semesterersättning, till en studiehjälpare vars kod en kompis sökt jobb med, intjänad när kompisen fått sitt konto (`varvningsbonus`, 2026-10-21); underlag för lönen, aldrig ett underlag i `payouts`. Hette tipsbonus (`tipsbonus`, 2026-10-13) |

## Behoven i matchningen (2026-10-21)

Leo: "det är ju behovet som ska ge oss den statistiken". Barnets behov fanns sedan Fas 15.4
(`students.behov`, sex koder i `NX.BEHOV`), men ingenting matchade mot dem, och
intresseanmälan frågade inte. `behov_i_matchningen` (20261021180000):

- **Intresseanmälan** frågar "Vad ska hjälpen göra?" (valfritt, flera går) och sparar koderna i
  `leads.behov`; upplägget sparas som kod i `leads.format_onskemal` (online, pa_plats, bada). Båda
  står också på svenska i meddelandet, så att den som ringer ser dem. Villkoren släpper bara igenom
  koderna, högst sex. Sidan tål att migrationen saknas: då skickas anmälan utan kolumnerna.
- **Ta in familjen** för behoven och upplägget till eleven (`nextrum-admin-kunder.js`).
- **Studiehjälparen** väljer sina styrkor bland samma sex i profilen (`tutor_profiles.styrkor`,
  "Det du är extra bra på"), och `skydda_tutorfalt` har kolumnen i vitlistan. Fältet döljs om
  kolumnen inte finns.
- **Poängen**: `matchningspoang()` har en ny signatur med elevens behov och studiehjälparens styrkor
  (`behov_mots()`), och den gamla med sju argument anropar den med tomma listor. Vikterna är omfördelade
  så att summan är 100, för adminvyn visar procent: ämne 45, årskurs 27, behov 12, utrymme 10,
  erfarenhet 6. Behoven ger aldrig ett hårt nej, och halva när någon sida saknar dem, som ämne och
  årskurs. Provat mot driften i en tillbakarullad transaktion: åk 9-eleven i matte, där båda
  studiehjälparna stod på 88, blev 94 mot 82 när den ena hade elevens två behov som styrkor.
- **Adminvyn** skriver meningen under Matchning ur samma två listor ("Bra på allt eleven behöver").
- Integritetspolicyn (båda språken) och `DATASKYDD.md` rad 1, 3 och 10 säger det.

