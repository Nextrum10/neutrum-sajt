# Notiserna, beskeden till den som söker och utbildningsprovet

Arkivet för notiserna, beskeden, utbildningsprovet och mejlens skal ur avsnitt 5 i `CLAUDE.md`,
och bakgrundskontrollerna ur avsnitt 11, ordagrant. Reglerna står i kärnan, `CLAUDE.md`.
"`manadskorning` ovan" i texten står i `databasen.md`, och "avsnitt N" är kärnans.

---

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

**`timmar_gar_ut` (Fas 21.2) är den enda notisen som inte gäller ett
pass.** Den köas av `intern.timmar_gar_ut_koa()`, som pg_cron-jobbet
`timmar-gar-ut` kör varje timme och som bara gör något mellan 9 och 20
svensk tid. En gång per kort och sista dag; ett förlängt kort får en ny.
Mallen läser `kvar` (heltal, 1–200) och `datum` ur `RenData`, och bara
familjen har raden i `NOTISVAL` (`bara: 'parent'`).

**Notiser som inte gick fram (System → Fel) är bara databasens egna
utskick** (2026-09-27). `notisfel()` läste förut hela
`net._http_response`, och dit kommer varje anrop genom pg_net, också
när en session provar en funktion efter en driftsättning. Utan
hemligheten svarar funktionen 401, med GET 405, och svaret stod sedan i
sex timmar som en notis som inte gick fram: adminvyn sa 8 fel, där tre
var samma fel i koden och fem var prov. Tabellen har ingen adress, och
ett prov och ett utskick med fel hemlighet ger samma 401, så skillnaden
syns bara när anropet görs.

- **Ring aldrig `net.http_post` direkt.** Databasens anrop går genom
  `intern.natanrop(mal, url := …)`, med samma parametrar som
  `net.http_post` och målet först. Den minns anropets id i
  `intern.natanrop_logg`, och `notisfel()` visar bara svar på de
  anropen och på webhooken för intresseanmälan (som minns sina i
  `supabase_functions.hooks`), med vägen i `kalla`. Ett anrop förbi
  `intern.natanrop` syns inte när det går fel; `rls-test.sql` har en
  rad som fångar det.
- **`grindfel` skiljer två 401:or.** Supabases grind svarar med
  `sb-error-code` (`UNAUTHORIZED_…`) när JWT-kravet slagits på igen
  (avsnitt 7, `config.toml`); funktionen själv svarar 401 när
  hemligheten inte stämmer. Adminvyn säger vilket.
- **Svaren finns i sex timmar** (`pg_net.ttl`), inte ett dygn. Listan
  svarar på "gick det fram nyss?", inte på "vad hände i natt?". Sex
  timmar är minst, inte exakt: pg_net tar bort gamla svar när arbetaren
  har något att göra, och 2026-09-29 låg fjorton timmar gamla svar kvar.
  Läs alltså aldrig ett saknat svar på ett gammalt anrop som ett fel.
  Månadskörningen är det enda utskicket vars svar också blir en uppgift
  (`intern.manadskorning_svar()`, se `manadskorning` ovan), för den går
  en gång i månaden och ingen tittar när den går.

`DEPLOY-NOTISER.md` har resten: de tre konfigurationstabellerna, hur
sandlådan slås på innan något provas, och de fem stegen för att lägga
till en ny notistyp utan att den faller ut som `okänd notistyp` ur en
trigger.

### Beskeden till den som söker (Fas 16.1)

Den som skickar in en intresseanmälan får ett kvitto (`lead-notis`,
`_delad/notiser/kvitto.ts`). Den som söker jobb får ett kvitto och
sedan ett mejl per steg framåt (`ansokan-notis`,
`_delad/notiser/ansokan.ts`), och varje sådant mejl visar alla fyra
stegen — Ansökan, Digitalt möte, Introduktion, Konto och godkännande —
med en markör där hen står.

```
applications (insert/update)
  → trigger ansokan_besked → intern.ansokan_besked_koa()
      rad i ansokan_utskick, unik på (ansokan_id, nyckel)
  → pg_net → ansokan-notis → ansokan_besked_ta() → Resend → ansokan_besked_klar()
  → pg_cron "ansokan-besked" var femte minut: omförsök, högst tre, bara senaste dygnet
```

| Händelse i adminvyn | Mejl |
|---|---|
| ansökan kommer in (vem som helst) | `mottagen`: tack, svar inom 24 timmar |
| "Kontakt" | **inget** — admin skriver själv, med förslag på tider |
| mötet sparas eller får ny tid/länk | `mote`: tid i svensk tid, länken som knapp |
| "Mötet är hållet" | `utbildning`: tack, introduktionen är nästa steg |
| "Utbildningsmötet är hållet", eller Öppna provet i ansökans översikt | `prov`: länken till provet, öppet i tre dagar (Fas 22.1). Adminvyn frågar först |
| dagen efter, och sista dagen, kl. 9 | `prov_paminnelse`, `prov_sista_dagen` (pg_cron `utbildningsprov-paminn`) |
| "Öppna provet i tre dagar till" | `prov` igen, med den nya sista dagen |
| provet klarat, eller "Markera utbildad" | `sista_steget`: skapa konto med samma e-post |
| läget blir Godkänd | `valkommen` |
| läget blir Avböjd | **inget, med flit** |

Sex regler bär det:

1. **INSERT-grenen läser bara kvittot.** Vem som helst kan skriva en
   rad i `applications`, så ingenting annat i raden får styra ett
   mejl. `skydda_ansokningsfalt` nollar dessutom `mote_tid` och
   `mote_lank` vid en insert som inte kommer från admin: annars hade
   en främling kunnat få oss att mejla "ditt möte är bokat" med en
   länk hen själv valt, från vår domän med godkänd DKIM.
2. **Möteslänken prövas två gånger.** Adminvyn nekar allt som inte är
   en https-adress innan det sparas, och `sakerLank()` gör bara en
   https-adress utan inloggningsdel till en knapp. Annars säger mejlet
   att länken kommer senare.
3. **Ett steg mejlas en gång.** Nyckeln är steget, utom för mötet där
   den är tid plus länk: ny tid är nytt mejl ("Ny tid för ditt möte"),
   samma tid igen är det inte. Ångra och klicka igen ger inget nytt
   mejl.
4. **Ett nej skrivs av en människa.** Den som söker är ofta sexton, och
   ett felklick som genast mejlar ett nej går inte att ta tillbaka.
5. **Kvittot bromsas vid flod.** Fler än fem ansökningar på en minut
   eller tjugo på en timme, eller samma adress igen inom ett dygn, blir
   `bromsad` — raden finns, mejlet går inte. Det är skyddet mot att
   formuläret används för att skicka våra mejl till främlingar. Samma
   adress jämförs som den levereras (`intern.epost_nyckel()`: utan
   skiftläge, kantmellanslag och plustillägg), och `created_at` sätts
   av `skydda_ansokningsfalt`, inte av den som postar (Fas 16.1c).
   Innan dess gick bromsen runt med en bakdaterad rad. **`leads` hade
   samma hål och har samma rättelse** i `skydda_leadfalt`: bromsen i
   `lead-notis` och analysvyerna räknar på den kolumnen. Sedan Fas 16.2
   har familjekvittot också samma regler, räknade i databasen av
   `lead_kvitto_broms()` (bara `service_role`). Förut räknade
   `lead-notis` själv med ilike på den exakta adressen, och ett
   plustecken räckte för att få ett kvitto till.
6. **Godkänd i rullgardinen är inte "Ta in i poolen".** Båda mejlar
   välkomsten, men bara den senare godkänner profilen. Rullgardinen
   frågar därför först.

### Utbildningsprovet (Fas 22.1)

Efter utbildningsmötet gör den som söker ett prov på nätet:
`/utbildningsprov?t=<nyckel>`, tjugosex flervalsfrågor om
Handledarhandboken, ingen tidsgräns, godkänt vid 21 rätt (80 procent).
Frågorna var trettio till 2026-10-02, då Leo tog bort fyra (varierad
träning, att dokumentera objektivt, ångesten och den aggressiva
föräldern) och lät skriva om den om ett barn som far illa
(`oro-hemma`, förut `far-illa`): den är provets viktigaste, och
handboken säger samma sak som förut, undersök inte själv, dokumentera
och kontakta Nextrum och socialtjänsten.
Hen får göra om det tills det går. Klarat prov sätter `prov_godkant_at`
OCH `utbildad_at`, och då går mejlet om kontot av sig självt; "Markera
utbildad" finns kvar för admin, men frågar först om provet inte är
klarat. Fem regler:

1. **Facit finns bara i edge-funktionen** (`_delad/utbildningsprov.ts`).
   Sidan får frågorna utan svaren, med alternativen i ny ordning vid
   varje hämtning. Gränsen prövas en gång till i
   `utbildningsprov_lamna()`, i heltal (`ratt * 5 >= antal * 4`).
2. **Resultatet säger rätt per avsnitt, aldrig per fråga.** Med fritt
   antal försök och svaret per fråga går provet att klara på tre
   försök utan att ha läst något. Av samma skäl: högst tio försök per
   dygn, räknat i databasen.
3. **Den som söker har inget konto än**, så provet öppnas med en
   slumpad nyckel (`prov_nyckel`, ett uuid). Den öppnar provet och
   inget annat, står i mejlen och adminvyn men aldrig i en logg, och
   sidan har ingen mätning och inget `Referer`. `utbildningsprov` har
   `verify_jwt = false` och når databasen bara genom
   `utbildningsprov_lage()` och `utbildningsprov_lamna()`, båda bara
   för `service_role`.
4. **Tre dagar räknas i svensk tid**: markeras mötet en måndag är
   provet öppet till och med torsdag. `applications_utbildningsprov`
   (en BEFORE-trigger) sätter `prov_sista_dag` och nyckeln.
   **`ansokan_besked` måste lista `utbildningsmote_at`** fast den
   aldrig läser kolumnen: en `UPDATE OF`-trigger går bara på kolumner
   som står i själva UPDATE:n, inte på dem en BEFORE-trigger ändrar.
   Utan den gick länken aldrig ut. Ett rullat prov fångade det.
5. **Påminnelsernas nyckel bär sista dagen** (`prov_paminnelse:2026-09-30`).
   Öppnas provet igen blir det ett nytt fönster med nya påminnelser,
   och en påminnelse från det gamla hoppas över av
   `ansokan_besked_ta()`. Ingenting skickas före klockan nio.

Frågorna är skrivna ur handboken som den såg ut i september 2026.
Handboken finns inte i repot. Ändras den ska frågorna läsas om, och
en fråga som byter betydelse får ett nytt id:
`utbildningsprov_forsok.svar` lagrar id:n. Sidan finns bara på
svenska, med flit: handboken gör det också.

**Formen får inte avslöja svaret** (2026-09-28). Första versionen hade
det längsta alternativet rätt i 25 av 30 frågor, så provet gick att
klara utan att ha läst något. De fel alternativen är nu lika utförliga
som det rätta, och Nextrum och rutinerna står också i fel svar.
`utbildningsprov_test.ts` räknar vad "alltid längsta", "alltid
kortaste" och "det som nämner Nextrum" ger, och taket ligger kring
slumpen (7 av 26). Skriver du om en fråga, kör proven.

**Provet öppnas från ansökans översikt** (2026-09-29). Leo: "på
rekrytering och utbildning i admin kan man inte lägga in
utbildningsprovet". Knappen fanns bara under steg 3 i panelens flik
Rekryteringen, nedanför skärmkanten, och fliken Utbildning visade bara
den vars möte i steg 2 var avbockat. Nu står Öppna provet på raden
Provet (`provKnapp`), stegens knappar står direkt under skälet,
flikarna Intervju och Utbildning öppnar panelen på Rekryteringen
(`data-dp-start`), och Utbildning tar också den som har ett
utbildningsmöte utan att steg 2 är avbockat.

**Admin kan göra provet själv** (2026-10-02, Leo: "gör provet
tillgängligt för admin genom admin vyn"). Prova utbildningsprovet i
Ansökningars rubrikrad öppnar `/utbildningsprov?prova` i en ny flik.
Anropet bär adminens egen inloggning i stället för en nyckel, och
`utbildningsprov` prövar `kravAdmin` innan något lämnas ut. Samma
frågor och samma rättning, men inget sparas och ingen ansökan rörs,
och svaret har genomgången fråga för fråga med facit (`genomgang()`).
Det är den enda vägen facit lämnar funktionen: regel 2 ovan gäller den
som söker, och nyckeln i länken räcker aldrig till provläget. En
funktion som inte driftsatts med provläget svarar 404 utan nyckel, och
sidan säger då att den behöver driftsättas.

Utfallet syns i rekryteringsrutan vid det steg som skickade mejlet, och
ett som inte gick fram är rött. Samma sort som kvittot till familjen:
inget går att välja bort, avsändaren är info@, och ingenting ur
ansökan återges utom förnamnet.

**Loggan i alla mejl är en riktig bild** sedan Fas 16.1:
`bilder/nextrum-logo-512.png`, ritad i 32×32 med `alt=""` och ordet
Nextrum som text bredvid, så att ett mejlprogram som blockerar bilder
fortfarande visar avsändaren. Filen är undantagen i `.gitignore`; tas
undantaget bort blir loggan en trasig bild i varje mejl.

**Alla mejl vi skickar har samma skal** (2026-09-25): `skal()` i
`_delad/notiser/rendera.ts`. Sajtens papper ända ut till kanten, ingen
ram, kant eller mörkare yta runt brevet, loggan överst. Notismejlen,
kvittot och ansökningsbeskeden går genom det via `renderaRam()`;
underlaget i `faktura-utskick` och aviseringen i `lead-notis` anropar
det direkt. Förut hade de två egna färger — underlaget en kant i en ton
som inte fanns i paletten, aviseringen ingen alls — och ramen låg kvar
på det gamla papperet samma dag som sajtens ljusnade. Papperet står på
`body` för Apple Mail OCH som `bgcolor` på yttertabellen för Gmail, som
kastar body-stilen: tas ett av dem bort blir det vitt i det programmet.
Det vita som ändå syns runt ett mejl i Gmail på datorn är Gmails eget
och går inte att nå inifrån ett mejl. Kontomejlen (bekräfta konto,
inbjudan från `bjud-in`, Glömt lösenordet) skickas av Supabase Auth med
mallar i dashboarden, inte härifrån, och har inte det här skalet.
Texterna står i `minne/sakerhet.md` (Kontomejlen).

---

## Ur avsnitt 11

- **Bakgrundskontroller.** Godkännandet är en knapp, inte en process.
  Fas 13.1 gav rekryteringen en ORDNING (kontakt, digitalt möte,
  utbildning, poolen) med skälet till varje steg skrivet i vyn, men
  inget av stegen kontrollerar något utifrån: mötet bokas inte i en
  kalender (kopplingen till Google gör bara onlinepassens Meet-länkar,
  Fas 18.1). Sedan Fas 22.1 har utbildningen ett prov systemet läser
  resultatet av, men det prövar att hen läst handboken, inte vem hen
  är.

### Barnkontots tekniska adress får inga mejl (barnkonton_och_admin, 2026-09-30)
Kontots adress, `<namn>@barn.nextrum.se`, får aldrig ett mejl. `notis_utskick_ta` hoppar över
barnkonton och adresser på `barn.nextrum.se`, och `notis-ko` gör det en
gång till (`arBarnadress` i `_delad/barnkonto.ts`), så att en rad som ändå
kommer ut ur kön blir `loggad` utan att skickas. `notis_konfig.lage` rördes
inte. Barnets notiser står i en egen tabell, `barn_notiser`, som fylls av
`bookings_barnnotis`: en mening utan pris och utan föräldern, och ett fel
blir en rad i `notis_fel` i stället för att stoppa passet. Se
`minne/barnkonton-och-admin.md`.

### Mejl till barnets egen adress (barnets_epost, 2026-10-01)
Bakom flaggan `barn_epost`, som står av tills juristen läst. En rad i
`notis_utskick` har antingen `mottagare` (ett konto i `profiles`) eller
`barn_id` (ett barn i `students`), aldrig båda
(`notis_utskick_en_mottagare`); mottagaren kan alltså vara null nu, och
allt som läser kön ska tåla det. Barnets rader köas av
`intern.barn_mejl_koa` (samma samlingsregel som `notis_koa`) och prövas
FÖRST i varvet i `notis_utskick_ta`, med läget just då: flaggan, en
bekräftad adress, förälderns val (`barn_epost.notiser`), barnets val
(`barn_epost.av`), aktiv inloggning och att passet fortfarande är bokat på
tiden i raden. Adressen tas ur `barn_epost`, sandlådan och `notiser_mejl`
gäller som för alla, och svaret har rollen `barn` och barnets id som
mottagare. Sorterna: `barn_pass_bokat`, `barn_pass_avbokat`,
`barn_paminnelse` (`intern.barn_mejltyper()` och `BARN_MEJLTYPER` i
`typer.ts`, ändras tillsammans), och bekräftelsen `barn_bekrafta_epost`,
vars kod bara finns i svaret, aldrig i kön. `notis-ko` skriver barnets
mejl med `notiser/barn.ts`: knappen till `/barn`, inget pris, ingen
betalning, inget avbokningsskäl, och bekräftelsen utan namn och utan
avanmälan. Barnets avanmälningstoken har fem delar
(`barn.<id>.mejl.<typ>.<sig>`, `skapaBarnToken`/`lasBarnToken`) och går
genom `notis-avanmal` till `barn_notis_avregistrera`, som bara stänger av
i `barn_epost.av`. `/avanmal` behandlar tokenen som text och behövde
ingen ändring. Se `minne/barnkonton-och-admin.md`.
