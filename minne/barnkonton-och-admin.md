# Barnens inloggning och adminbehörigheterna (barnkonton_och_admin, 2026-09-30)

Läses när arbetet rör barnets vy (`barn.html`), föräldrarnas ruta Barnens
inloggning, adminrollerna eller adminvyns System → Adminhantering. Reglerna
står i `CLAUDE.md`; här står varför och fällorna.

Allt kom i en migration, `supabase/migrations/20261001000000_barnkonton_och_admin.sql`,
med två edge-funktioner (`barn-konto`, `admin-skapa`) och deras rena delar i
`_delad/barnkonto.ts` och `_delad/adminbehorighet.ts`, och en rättelse samma
kväll, `20261001000200_barnkonto_skapas_genom_auth.sql`: barnkontot gick inte
att skapa genom riktiga Auth (se Auth nedan). Versionerna i filnamnen är de
som står i `supabase_migrations.schema_migrations` i driften.

## Del 1: barnets inloggning

### Hur ett barn kommer in
- Föräldern skapar inloggningen i studievyn (Profil & inställningar → Barn,
  rutan Barnens inloggning): användarnamn, lösenord två gånger och en
  kryssruta där föräldern bekräftar att hen är vårdnadshavare och godkänner
  att barnet använder Nextrum, med länk till `/integritetspolicy#barn`.
- `barn-konto` prövar föräldern med ANROPARENS token (barnet läses genom RLS,
  sedan `parent_id = anroparen`), väljer kontots id, öppnar ett
  skapandefönster för det och skapar kontot med `service_role`: id:t,
  adressen `<användarnamn>@barn.nextrum.se` och `email_confirm`. Rollen,
  `app_metadata {roll: 'barn', forald_id, barn_id}` och kopplingen till
  barnet skriver databasen (se Auth nedan).
- Barnet loggar in med användarnamnet under Elev i studievyns eller
  studiehjälparvyns inloggning (`/foralder#elev`, sedan 2026-10-06; före
  det på `/barn`, som nu inte har någon egen inloggning). Adressen byggs i
  webbläsaren och barnet ser den aldrig. Felet är alltid "Fel användarnamn
  eller lösenord", utom när nätet inte svarar eller Supabase säger 429 för
  många försök; inget av dem säger något om vilka användarnamn som finns.
- **E-post eller användarnamn, i varje inloggning (2026-10-01).** Det
  första riktiga barnkontot gick inte att logga in med. Logga in på
  sajten leder till studievyn ("Förälder eller elev"), där fältet hette
  E-post och ett användarnamn fick "Fel e-post eller lösenord", och
  `/barn` nås bara om man skriver adressen; ingen länk dit, och ingen
  från `/barn` till föräldervyn. Auths logg visade två nekade försök
  minuten efter att kontot skapats. Samma dag, Leo: "man kan logga in
  med användarnamn eller epost ... barns konton ska bara vara
  användarnamn och lösenord som styrs av föräldern", för att inte
  krångla med registret och integritetspolicyn. Nu går alla fyra
  inloggningarna (studievyn, studiehjälparvyn, adminvyn och `/barn`)
  genom `NXStudie.loggaIn`, som bara läser formen på det som skrivs:
  med @ är det en vuxens e-post, som Auth får som förut; utan @ är det
  ett barns användarnamn (regeln ANVANDARNAMN), och barnet hamnar på
  `/barn`; barnkontots tekniska adress nekas med "Fel e-post eller
  lösenord" utan att Auth tillfrågas. En vuxen som skriver sin e-post på
  `/barn` kommer till sin egen vy; det är ingen länk dit, för det krävs
  den vuxnes lösenord. Fältet heter "E-post eller användarnamn" bara i
  studievyn, dit både barn och vuxna kommer; i studiehjälparvyn och
  adminvyn heter det E-post, för ingen vuxen har ett användarnamn, och
  på `/barn` Användarnamn. Familjens uppgifter hämtas aldrig med
  barnets inloggning, och barnets funktioner aldrig med en vuxens.
  Glömt lösenordet ger ett användarnamn och den tekniska adressen
  beskedet att föräldern byter lösenordet, i alla vyer. (Det som sägs om
  `/barn` som inloggning här gällde till 2026-10-06; se Elev i rollvalet.)
- **Varför den tekniska adressen finns.** Supabase Auth tar ett lösenord
  bara ihop med en e-postadress eller ett telefonnummer ("sign in with a
  password connected to their email or phone number", dokumentationen
  2026-10-01). Adressen byggs ur användarnamnet, och den är inte en
  uppgift till om barnet: integritetspolicyn och `DATASKYDD.md` (rad 20)
  säger redan att inloggningen är ett användarnamn och ett lösenord,
  ingen e-postadress. Att ta bort den hade krävt en egen inloggning
  bredvid Auth, med egna tokens; det är inte gjort, med flit.

### Rollen nextrum_barn, och varför en egen roll
Det stod i uppdraget att allt för barnet ska vara stängt som förval. Två
vägar fanns: en policy per tabell som säger nej till barn (och en ny tabell
som glömmer policyn är öppen), eller en egen Postgres-roll som inte har
några rättigheter alls. Vi valde rollen. PostgREST byter till rollen i
tokens `role`-anspråk, som GoTrue sätter från `auth.users.role`.
`authenticator` är medlem i `nextrum_barn`, och rollen har `usage` på
`public` och EXECUTE på barnets egna funktioner: `barn_oversikt()`,
`barn_notiser()`, `barn_markera_last(id)` och, sedan 2026-10-01,
`barn_nexlax()` och `barn_uppgift(id, status)`, och på de fyra NexLäx-
funktionerna (`niva_starta`, `niva_svara`, `niva_genomgang`,
`nexlax_lage`), som prövar att det är barnets eget id och att
inloggningen är aktiv (`intern.mitt_aktiva_barn`, `nexlax_for_barnet`).
`rls-test.sql` prövar det med en slinga över varje tabell och vy, med
katalogen (`has_table_privilege`, `has_function_privilege`) och med
avsnitt 14 för NexLäx.

Fällan: **en ny tabell eller vy ska inte ge `nextrum_barn` något**, och en
`grant ... to public` gör det. Ett förval i `alter default privileges`
som nämner `public` gör det också.

Det fungerar mot riktiga Supabase, provat 2026-09-30 (se Driften nedan):
`grant nextrum_barn to authenticator` gick igenom, GoTrue satte
`role: nextrum_barn` i barnets token, `barn_oversikt` och `barn_notiser`
svarade, och `students`, `profiles`, `bookings` och `mina_behorigheter`
gav 403 `permission denied` (42501).

### Barnet hittas i databasen
`intern.mitt_barn()`: `students.user_id = auth.uid()` OCH `app_metadata`
säger `roll = barn`, samma `barn_id` och samma `forald_id`, och barnet är
inte raderat. Token och tabellen måste säga samma sak. Ett pausat barn
(`barn_aktiv = false`) får `{lage: 'pausad'}` och inga notiser.

`barn_oversikt()` svarar förnamn, studiehjälparens förnamn (bara när
matchningen inte väntar), kommande pass (önskade och bekräftade),
genomförda pass (med en rapport där barnet inte var frånvarande, högst 50),
timmarna, studieplanen och, om föräldern slagit på det, de 20 senaste
rapporterna. **Timmarna är genomförda och bokade pass, aldrig timbanken
eller klippkortet**: det är familjens pengar, och barnet ska inte se pengar.
Ett påhittat saldo fanns inte att visa, så vyn säger vad som hänt.

### Auth: hur kontot skapas, och vad som spärras i auth.users
**GoTrue skapar ett konto i flera steg**, i en och samma transaktion
(supabase/auth, `internal/api/admin.go`, `adminUserCreate`): raden skrivs
med ett id och `app_metadata {provider, providers}`, och anropets
`app_metadata`, rollen, bekräftelsen och `user_metadata.email_verified`
kommer i var sin UPDATE efteråt. Den första spärren krävde `roll = barn`
redan vid INSERT och nekade därför varje barnkonto. Det syntes först när
kedjan provades mot riktiga Auth i driften 2026-09-30 (500 från
`POST /admin/users`, "Adresser på barn.nextrum.se är barnkonton ..."), för
`rls-test.sql` skrev raderna direkt, med `app_metadata` redan i INSERT.
**Prova i GoTrues ordning**: provet "kontot skapas som GoTrue gör det" gör
nu så.

Rättelsen är ett **skapandefönster**. `barn-konto` väljer kontots id
(`crypto.randomUUID()`), öppnar en rad i `barn_andringsfonster` med
`andring = 'skapa'`, id:t, barnet och användarnamnet, och anropar
`auth.admin.createUser({ id, email, password, email_confirm })` utan
`app_metadata` och utan roll. Fönstret stängs i `finally`. Att Auth tar
emot ett id står i `adminUserCreate` (`params.Id`), och supabase-js 2.116.0
skickar det.

Tre triggrar på `auth.users`, och mejlspärren i två av dem:
1. `auth_barnkonto_skapas` (BEFORE INSERT): en adress på barndomänen, eller
   `roll = barn`, släpps bara in med ett öppet skapandefönster för exakt
   det id:t och användarnamnet, högst 60 sekunder gammalt, och barnet ska
   finnas, inte vara raderat och inte ha en inloggning. Familjen tas ur
   fönstret och barnets rad, aldrig ur anropet (står den ändå i anropet ska
   den vara fönstrets). Triggern skriver `app_metadata {roll, barn_id,
   forald_id}` och `role = nextrum_barn`, tömmer `user_metadata`, sätter
   mejlspärren och förbrukar fönstret. **En registrering genom `signUp` får
   sitt id av Auth och hittar inget fönster**, också medan föräldern skapar
   samma användarnamn. Därför är id:t bundet, inte bara namnet: ett fönster
   på namnet hade varit en kapplöpning den som vet användarnamnet kan vinna.
2. `auth_barnkonto_kopplas` (AFTER INSERT): sätter `students.user_id`.
3. `auth_barnkonto_las` (BEFORE UPDATE): för ett barn skrivs `roll`,
   `barn_id` och `forald_id` tillbaka ur den gamla raden och rollen tvingas
   till `nextrum_barn`, vad uppdateringen än säger. GoTrue skriver
   `app_metadata` ur sitt minne, och en skrivning utan rollen ska varken göra
   barnet till ett vanligt konto eller fälla Auth; förut nekades den (42501),
   och det hade fällt skapandet en gång till. Ett vanligt konto som får
   `roll = barn` nekas som förut. Adress, `email_change`, token för
   återställning och byte, och telefonen går inte att röra (42501).
   Lösenordet (`encrypted_password`) går bara att ändra med ett öppet
   lösenordsfönster (`andring = 'losenord'`, högst 60 sekunder, förbrukas).
   Allt annat GoTrue skriver (senaste inloggning, `banned_until`,
   `updated_at`, `user_metadata`) går igenom; `senast_inloggad` följer med
   till `students` i ett eget undantagsblock, så att ett fel där aldrig
   stoppar en inloggning.

**Mejlspärren.** GoTrue skickar sina mejl INNAN den sparar token
(`internal/api/mail.go`, till exempel `sendPasswordRecovery`), så spärren på
`recovery_token` ensam hade låtit mejlet gå till en adress som inte finns.
Men GoTrue prövar först `*_sent_at` plus frekvensen mot nu. På ett barnkonto
står därför `confirmation_sent_at`, `recovery_sent_at`,
`email_change_sent_at` och `reauthentication_sent_at` år 2999
(`intern.barnkonto_mejlsparr()`), och båda triggrarna skriver tillbaka dem
(ett lösenordsbyte genom Auth nollar dem, `UpdatePassword`). Återställning,
magisk länk, ny bekräftelse, omautentisering och adressbyte svarar då 429
innan något mejl går. Inbjudan har ingen sådan spärr, men den kräver
`service_role`, och `admin-skapa` nekar barnadresser.

`handle_new_user` ger inget föräldrakonto till ett barn (`roll = barn` går
förbi den; AFTER-triggern ser det BEFORE-triggern skrev).

Fällor:
- **Rättelsen står på tre saker i GoTrue**: att `createUser` tar ett id,
  att raden skrivs före `app_metadata`, och att frekvensspärren prövas före
  mejlet. En uppgradering av Auth som ändrar något av det syns som ett 500
  när en förälder skapar en inloggning (id:t eller ordningen), eller som
  mejl till barnadresser (spärren). Null-MX:en på `barn.nextrum.se` är
  andra lagret: post dit studsar direkt i stället för att hamna någonstans.
- **Skriver GoTrue om hashen vid en inloggning** är det en ändring av
  `encrypted_password` utan fönster. Triggern säger nej, och barnet kommer
  inte in. `Authenticate` (`internal/models/user.go`) räknar om hashen i
  minnet när bcrypt-kostnaden är över 10 eller exakt 4, men skriver den bara när
  hashkrypteringen är på (`shouldReEncrypt`, `internal/api/token.go`).
  Barnens hashar görs av GoTrue med kostnad 10. Slå inte på
  hashkrypteringen i Auth utan att tänka på det här.
- "Secure email change" ska vara på i Auth, och manuell länkning av
  identiteter av.

### Pausa, byta lösenord, ta bort
- Pausa: `barn_aktiv = false` först, sedan `ban_duration`, sedan
  `barnkonto_logga_ut(barn)` (tar bort barnets sessioner och refresh-token).
  En åtkomsttoken som redan lämnats ut gäller högst en timme till, men då
  svarar barnets funktioner redan `pausad`.
- Byta lösenord: fönstret öppnas, lösenordet byts, fönstret stängs i
  `finally`, barnet loggas ut överallt.
- Ta bort inloggningen: kontot tas bort i Auth; FK `students.user_id` blir
  null, och `students_barnkonto_stadas` tar bort notiserna och fönstren och
  nollar användarnamnet. Barnet, passen och rapporterna står kvar.
- Raderas eller avidentifieras barnet (`radera_person`) tar samma trigger
  bort kontot i Auth.

### Notiserna till barnet
`barn_notiser` fylls av `bookings_barnnotis` (bekräftat, avbokat, avslaget,
motförslag, genomfört), en mening utan pris och utan namn på föräldern.
Triggern kastar aldrig: ett fel blir en rad i `notis_fel`, som i
`notis_vid_pass`. **Kontots tekniska adress får aldrig ett mejl**:
`notis_utskick_ta` hoppar över barnkonton och barnadresser, och `notis-ko`
gör det en gång till (`arBarnadress`). `notis_konfig.lage` rördes inte.
Gallras efter 180 dagar (`barnkonton-gallring`, 03.59 UTC). Barnets egen,
bekräftade adress kan få mejl sedan 2026-10-01, se nästa avsnitt.

### Barnets egen e-post (barnets_epost, 2026-10-01)
Leo: "gör också att man kan lägga till epost för sitt barn och att man kan
logga in med specifik epost för barn vyn, fixa med gdpr ... inställningar
för profil samt notiser". Valt: inloggning och mejlnotiser; föräldern styr
lösenordet; Auth mejlar aldrig ett barn; juristen läser innan det går
live. **Flaggan `barn_epost` står av** tills dess (`flaggor`, `vantar_pa`
säger vad som väntas), och med den av syns rutan inte, inloggningen med
adressen nekas och inga mejl går till barn. Ta bort och stäng av går alltid.
Migrationen och de tre funktionerna är i drift sedan 2026-10-01; det som
väntar är juristen och ett prov i sandlådan (`DEPLOY-BARNKONTON.md` 8).

Varför adressen inte ligger i Auth: barnkontots identitet är den tekniska
adressen, och alla spärrar i `auth_barnkonto_las` bygger på den. En riktig
adress i `auth.users` hade gjort att Auth kunde mejla barnet (bara
`*_sent_at` år 2999 hade stått emellan), krockat med vuxna konton på samma
adress, och gjort adressbyten till en Auth-fråga. Nu:
- **`barn_epost`** (en rad per barn, FK med cascade): `epost` (gemener,
  aldrig `@barn.nextrum.se`), `bekraftad`, `kod_omgang`, `kod_skapad`,
  `notiser` (förälderns val), `av` (barnets egna avstängda sorter). RLS på,
  inga rättigheter för anon, authenticated eller `nextrum_barn`:
  studiehjälparen, som läser `students` för sina elever, ser den aldrig.
  En bekräftad adress är unik; obekräftade får krocka, och den som äger
  inkorgen avgör (`upptagen` om en annan redan bekräftat den).
- **Föräldern** (`authenticated`): `mina_barns_epost()` (flaggan och
  adresserna för barnen med inloggning), `barn_epost_satt`,
  `barn_epost_skicka_igen`, `barn_epost_ta_bort`, `barn_epost_notiser`.
  Alla prövar föräldern i `intern.barn_epost_forald` (radlås, inte ett
  barns token); att lägga till, skicka och slå på kräver flaggan och en
  inloggning, att ta bort och slå av gör det inte. Förälderns egen adress
  nekas. Varje händelse skrivs i `audit_logg` (`barnepost.*`), aldrig
  adressen.
- **Bekräftelsen**: koden är `<barn_id>.<HMAC>` över barnet, adressen och
  omgången med `notis_konfig.barn_nyckel`. Den sparas ingenstans: kön bär
  bara `omgang`, och `notis_utskick_ta` räknar fram koden när mejlet ska
  gå (samma kod vid ett omförsök). Ny adress eller Skicka igen ger en ny
  omgång, så bara den senaste länken gäller; den gäller sju dagar. Taket är
  ett mejl i minuten och fem om dygnet per barn, räknat på kön, så att det
  inte nollställs av att adressen tas bort och läggs till. Länken går till
  `/barn?bekrafta=<kod>`; vyn tar koden ur adressen direkt och bekräftar
  bara när knappen trycks (`barn_epost_bekrafta`, för anon, authenticated
  och `nextrum_barn`; svarar ok, redan, gammal, upptagen, av eller
  ogiltig). Hasharna jämförs, inte koderna.
- **Inloggningen**: edge-funktionen `barn-inloggning` (verify_jwt av)
  tar `{ epost, losenord }`, frågar `barn_inloggning_uppslag` (bara
  `service_role`), som räknar försöket per adress och IP-nummer (HMAC i
  `intern.barn_inloggning_forsok`, tio respektive tjugo på en kvart, ett
  dygn) innan den slår upp, och loggar in med den tekniska adressen hos
  Auth. Svaret är sessionen; vyn lägger den på plats med `setSession`.
  Varje nej tar minst 0,9 sekunder och säger samma sak. I vyerna:
  `NXStudie.loggaIn` provar en adress med @ hos Auth som förut, och bara
  när Auth svarar `invalid_credentials` provas den som barnadress; beskedet
  är då den vuxnas. Auth ser funktionens IP-nummer (att skicka barnets
  kräver en ny sorts hemlig nyckel, `Sb-Forwarded-For`), därav taket per
  nummer: en ensam angripare ska inte tömma Auths kvot.
- **Mejlen**: `intern.barn_passmejl_koa` från `intern.barnnotis_vid_pass`
  (bokat och avbokat, samma samlingsnyckel per pass i tre minuter) och
  `intern.barn_paminnelse_koa` från `notis_planera` (samma tider som
  familjens). Raden har `barn_id` och ingen `mottagare`
  (`notis_utskick_en_mottagare`). `notis_utskick_ta` prövar en barnrad
  först i varvet: flaggan, adressen, förälderns val, barnets val, aktiv
  inloggning och att passet fortfarande är bokat på den tiden; rollen i
  svaret är `barn`. `notis-ko` skriver den med `barn.ts`, och barnets
  avanmälan (`barn.<id>.mejl.<typ>.<sig>`) går till
  `barn_notis_avregistrera`, som bara stänger av i `av`.
- **Städningen**: tas inloggningen bort tar `barnkonto_stadas` adressen och
  barnets rader i kön; `barnkonton_gallra` tar en obekräftad adress efter
  30 dagar och försöken efter ett dygn.

### Vyerna
- `barn.html` + `nextrum-barn-vy.js`: NX, NXStudie och, sedan
  2026-10-01, NXUppgifter för NexLäx (ingen betalning, ingen bokning, och
  kontakt bara i barnets egen tråd, nedan), skarp CSP (`/barn` i `vercel.json`),
  `noindex` och `Disallow` i `robots.txt`. Ingen länk till föräldervyn och
  ingen kontoinställning; "Vill du ändra något? Fråga din förälder." Allt
  utom NexLäx och tråden ritas med `textContent`; tråden ritas av
  `NXStudie.barnTråd` och NexLäx av NXUppgifter, båda med `esc()`,
  som i studievyn, i läget `barnvy` (ingen bedömning, inga pass i Din
  utveckling). Se `minne/nexlax.md`.
- **Elevvyn (2026-10-06).** Leo: "På elevvyn ska bara Översikt, nexläx,
  meddelanden, och profil för barnet finnas", och "man ska också kunna
  logga in på elev, på logga in på studievyn". Vyn har nu studievyns skal:
  hälsningen med dagens bild (`NXArbete.hero`, se `minne/vyerna.md`; NXArbete
  laddas bara för den, och modulvakten prövar `dagensHero`) och sidomenyn
  (`NXStudie.sidomeny`). Först fyra delar; samma kväll fem (nedan).
- **Fem delar (2026-10-06, kvällen).** Leo: "Lägg också till mina lektioner
  sektionen på elev vyn bara att ingen betalning syns utan bara lektionerna,
  rapporter osv. På översikt på barn vyn ha antal genomförda lektioner. och
  kommande lektioner istället för timmar genomförda. Man ska kunna skriva
  till sin studiehjälpare på barn vyn".
  - Översikt: två siffror, genomförda och kommande pass (`antal` i
    `barn_oversikt`, räknat i databasen; utan nyckeln räknas listorna),
    det närmaste passet och en länk till Mina lektioner. Timmarna visas
    inte längre, men `timmar` står kvar i svaret.
  - Mina lektioner: flikarna Pass (kommande och genomförda), Studieplan
    och Rapporter, som studievyns sektion men utan betalning, pris,
    bokning eller avbokning. Fliken Rapporter göms när föräldern inte slagit
    på `visa_rapporter`.
  - NexLäx: som förut. Utan `barn_nexlax` i databasen står ett besked i
    stället för flikarna, för delen finns alltid i menyn, och likadant när
    föräldern stängt av NexLäx (`lage: 'avstangd'`, se Barnets behörigheter).
  - Meddelanden: tråden med studiehjälparen överst (nedan), sedan Från
    Nextrum, barnets notiser (`barn_notiser`). Siffran i menyn och på
    hälsningens kort är olästa notiser plus olästa meddelanden; det
    föräldern stängt av räknas inte.
  - Profil: inställningarna (`barn_installningar`), frågan till föräldern
    och Logga ut. Länken "Ändra dina val" i mejlen pekar på
    `#installningar`; vyn byter den mot `#profil` och hoppar förbi
    hälsningen, så att `barn.ts` inte behöver ändras.
- **Barnets chatt (barnets_chatt, 2026-10-06).** Förut "ingen chatt, med
  flit": familjens tråd är förälderns, och vuxen och barn i enrum är ett
  beslut. Leo tog det: en egen tråd mellan barnet och studiehjälparen, som
  föräldern läser men inte skriver i, i drift direkt efter merge (ingen
  flagga). Därför:
  - En egen tabell, `barn_meddelanden`, inte `messages`: barnet har ingen
    rad i `profiles`, så `sender_id` går inte, och familjens tråd har
    realtid, agenter och notisflöden som inte ska se barnet. `fran` är
    `barn` eller `studiehjalpare`; `parent_id` och `tutor_id` står på varje
    rad, så föräldern läser med en policy och raderingen hittar raderna.
  - Ingen skriver i tabellen: barnet genom `barn_chatt_skriv()`, studie-
    hjälparen genom `barnchatt_skriv()`; båda prövar relationen
    (`intern.barnchatt_hjalpare`: matchad eller pausad, inte raderad) och
    har ett tak (20 respektive 30 på tio minuter). Barnet läser med
    `barn_chatt()` och markerar läst med `barn_chatt_last()` när delen
    visas; en pausad inloggning läser men skriver inte. Studiehjälparen ser
    bara sina nuvarande elever med inloggning (`barnchatt_tradar()`,
    `barnchatt_trad()`, som markerar barnets meddelanden lästa); byts
    studiehjälparen står den gamla tråden kvar för föräldern, inte för den
    gamla studiehjälparen.
  - Föräldern läser direkt i tabellen (policyn "föräldern läser barnens
    trådar"), utan att något markeras som läst, i rutan Barnens trådar
    under Meddelanden. Rutan ritas först när barnens och studiehjälparens
    namn finns (`S.namnKlara`).
  - Admin läser genom `barnchatt_las()` i familjens Öppna chatt, som loggar
    `chatt.oppnad` med tabellen `barn_meddelanden`, aldrig texten; aldrig
    direkt i tabellen från vyn.
  - Studiehjälparen får en notis av typen `meddelande` med barnets förnamn,
    aldrig texten, så kedjan och mallarna står som de är. Barnet får ingen
    notis och inget mejl om chatten.
  - Raderingen: raderna går med barnet (cascade), och triggern
    `profiles_barnchatt_rensa` tar familjens eller studiehjälparens rader
    när `raderad_at` sätts. De står kvar när bara inloggningen tas bort.
  - Ritas av `NXStudie.barnTråd` i alla tre vyerna, med `esc()` och utan
    klickbara länkar. Det står i barnets och studiehjälparens ruta att
    föräldern och Nextrum kan läsa; ta inte bort det.
  - Prövat i `rls-test.sql` avsnitt 21 och i `prova-barnkonton.js`.
  - I drift 2026-10-06, samma kväll som PR #203 mergades: migrationen kördes
    avsnitt för avsnitt med `execute_sql`, filens text hämtades till
    `schema_migrations` med `http` från merge-commiten (samma md5 som i git),
    de elva funktionskropparna har samma md5 som filen, och hela
    `rls-test.sql` från merge-commiten gick igenom mot driften, 1393 av
    1393, i ett block som slutade med ett avsiktligt fel så att allt
    rullades tillbaka (resultatet står i felmeddelandet). Inget blev kvar.
- **Elev i rollvalet (2026-10-06).** Inloggningen i studievyn och i
  studiehjälparvyn har tre kort: Förälder, Elev och Studiehjälpare; det
  förra "Förälder eller elev" heter Förälder. Först ledde Elev till `/barn`;
  samma kväll, Leo: "när man väljer att logga in som elev ska man inte komma
  till en separat sida de ska vara på samma sida där man loggar in som
  förälder och lärare". Nu är Elev ett läge i samma ruta
  (`NXStudie.elevLänk`, adressen `#elev`): rubriken Elevvyn, fältet
  Användarnamn, inga flikar för konto, och glömt lösenordet säger att
  föräldern byter det. Barnet hamnar på `/barn` efter inloggningen
  (`NXStudie.loggaInHär`), och en vuxen som loggar in i läget Elev laddar
  om sin egen vy utan `#elev`. `/barn` har ingen inloggning längre: utan
  session skickas man till `/foralder#elev`, och bara bekräftelselänken
  (`?bekrafta=`) visas utan inloggning. Fältet i förälderns läge heter
  fortfarande "E-post eller användarnamn", så ett barn som skriver sitt
  användarnamn där kommer också fram. De öppna sidornas Logga in-ruta
  (`.nx-vagval-val`, alla 41 sidor på båda språken; `var-ide.html` är
  skalet för de genererade) har samma tre val, och Elev pekar på
  `/foralder#elev`.
- En vuxen som är inloggad i samma webbläsare och öppnar `/barn` ser bara
  "Någon annan är inloggad" och Logga ut, aldrig sin egen vy därifrån.
- Rolldirigeringen: `NX.ärBarn(user)` läser `app_metadata`, aldrig
  `user_metadata`. `NX.skickaBarnHem()` i studievyn, studiehjälparvyn och
  adminvyn. Det är bara rätt sida; skyddet är rollen i databasen.
- Föräldrarnas ruta: `mina_barnkonton()` (tål att migrationen saknas:
  PGRST202 döljer rutan), `visa_rapporter` skrivs direkt på `students`
  och bara föräldern får ändra den (`skydda_studentfalt`). Sedan
  2026-10-06 är rapporterna ett av barnets sex val, och knappen för dem
  står bara kvar när `mina_barns_behorigheter()` saknas. Klasserna heter
  `bi-*` och data-attributen `data-bi-*`; `bk-*` är bokningens. Barnets
  e-post är en egen del under inloggningens knappar (`.bi-epost`,
  `data-bi-epost-*`), ur `mina_barns_epost()`; utan den funktionen ritas
  inloggningen som förut.
- Barnets Inställningar (`#installningar` i `barn.html`): användarnamnet,
  adressen och en rad per sort med valet, ur `barn_installningar()`; ett
  tryck skickar `barn_notisval`. Länken "Ändra dina val" i mejlen går hit
  (`#installningar`, utan mjuk scrollning, `scroll-margin-top` under
  sidhuvudet).
- Felrapporterna (`nextrum-fel.js`) når inte fram från ett inloggat barn:
  rollen får inte skriva i `klientfel`. Det är med flit (inga rättigheter),
  men det betyder att fel i barnets vy bara syns före inloggningen.

### Barnets behörigheter (barnets_behorigheter, 2026-10-06)
Leo: "familjen som skapar elev väljer vilka behörigheter barnet ska
vara". Föräldern väljer vad barnet får se och göra med sin egen
inloggning, när inloggningen skapas och när som helst efteråt:

| Val | Släpper fram | Förval |
|---|---|---|
| `pass` | kommande och genomförda pass, antalet och timmarna | på |
| `studieplan` | studieplanen | på |
| `rapporter` | rapporterna från passen (`visa_rapporter`, som fanns sedan förut) | av |
| `nexlax` | NexLäx: banan, nivåerna, läget, bocken på en uppgift och rapportknappen | på |
| `meddelanden` | Nextrums notiser till barnet (`barn_notiser`) | på |
| `chatt` | tråden med studiehjälparen (`barn_meddelanden`, barnets_chatt) | på |

- **Förvalet är det som gällde före**: allt utom rapporterna, som redan
  var av som förval. Barn som hade en inloggning behöll det de hade,
  rapporterna inräknade. Tråden kom samma kväll från en annan session
  (barnets_chatt, Leo: "på direkt efter merge") och är på som förval av
  samma skäl; att den går att stänga av lades till när de två slogs
  ihop, för annars hade föräldern kunnat stänga av allt utom just
  barnets direkta kontakt med en vuxen. Det barnet aldrig får (boka, avboka, svara,
  priser, betalningar, föräldern) står inte i listan, så det går inte att
  slå på.
- **Spärren ligger i databasen.** `students.barn_behorigheter` (text[],
  villkoret `students_barn_behorigheter_kanda`) bär fem av valen;
  rapporterna står kvar i `visa_rapporter`, så att inget som redan läste
  den behövde ändras. Barnets roll når inga tabeller, bara sina
  funktioner, och de prövar valet:
  - `barn_oversikt()` går genom `intern.barn_behorigt()`, som tar bort
    `kommande`, `genomforda`, `timmar` och `antal` utan pass och `studieplan` utan
    studieplan, och lägger till `behorigheter`
    (`intern.barnets_behorigheter()`, rapporterna medräknade).
  - `barn_notiser()` och `barn_markera_last()` svarar som för ett pausat
    barn när meddelandena är av. Notiserna skapas som förut; de lämnas
    bara inte ut, och syns igen när föräldern slår på dem.
  - `barn_nexlax()` svarar `{lage: 'avstangd'}`. `niva_starta`,
    `niva_svara`, `niva_genomgang`, `nexlax_lage` och `barn_uppgift`
    frågar `intern.mitt_nexlax_barn()` (aktiv inloggning och NexLäx på) i
    stället för `intern.mitt_aktiva_barn()`, och `rapportera_fragefel`
    nekar ett barn utan NexLäx: annars hade barnet kunnat spela genom att
    anropa funktionerna själv.
  - `barn_chatt()`, `barn_chatt_last()` och `barn_chatt_skriv()` svarar
    `{lage: 'avstangd'}` (eller 0) när tråden är av. Studiehjälparen
    skriver inte heller i den: `barnchatt_skriv()` svarar `avstangd`, och
    `barnchatt_tradar()` och `barnchatt_trad()` säger det (`avstangd`,
    `kan_skriva` falsk), så att vyn säger varför i stället för "pausad".
    Tråden står kvar och går att läsa för studiehjälparen och föräldern;
    barnet ser den igen när föräldern slår på den.
  - Familjens egen inloggning gör NexLäx åt barnet som förut; valet
    gäller barnets inloggning.
- **Bara föräldern ändrar valet**: `barn_behorigheter_satt(barn, lista)`
  sparar hela listan (42501 för alla andra, också admin och barnet;
  22023 för ett okänt val; 55000 utan inloggning), och
  `skydda_studentfalt` håller kolumnen för alla andra, som
  `visa_rapporter`. Tas inloggningen bort börjar valen om från förvalet.
  Valen står i auditloggen (`students_barnkonto_audit`) med föräldern som
  aktör. Föräldern läser med `mina_barns_behorigheter()`: alla val i
  vyns ordning (`intern.barn_behorigheter_alla()`) och varje eget barns.
- **Lapparna** gick på driftens text (`pg_get_functiondef` och en vakt som
  räknar träffarna), och funktionerna var md5-lika lokalt och i driften
  2026-10-06 innan de lappades. En lappad funktion bär ordet
  `barnets_behorigheter` eller `mitt_nexlax_barn`, så filen går att köra
  två gånger. Versionen var först `20261006200000`, sedan
  `20261006230000` (efter `nexlax_felrapporter`, vars `rapportera_fragefel`
  lappas), och blev `20261006233000` när barnets_chatt kom in i main med
  just `20261006230000`: den skapar chattfunktionerna som lappas här, och
  hade den körts efter hade den skrivit över lapparna. Filens första
  avsnitt stannar därför om `barn_chatt()` inte finns.
- **Studievyn**: valen står som kryssrutor i formuläret där inloggningen
  skapas (`biFårVal`, förvalet ikryssat) och som på/av på barnets kort
  (`biFår`, `data-bi-far`, minst 44 px höga). Valen i formuläret sparas
  efter att `barn-konto` skapat inloggningen, och bara om de skiljer sig
  från förvalet; ett tryck på kortet sparas direkt. Utan funktionerna
  (PGRST202) ritas kortet som förut.
- **Barnets vy** (med main:s fem delar) gömmer antalet pass och de
  närmaste i Översikt när passen är av (`data-bv-far="pass"`), med en rad
  överst (`#bv-avstangt-oversikt`). Under Mina lektioner göms flikarna
  Pass och Studieplan (Efter passen sköts av `ritaRapporter`, som körs
  före); står ingen flik kvar går flikraden, och en rad säger varför
  (`#bv-avstangt-lektioner`). I Meddelanden säger `#bv-chatt-av` att
  tråden är avstängd, och notiserna att de är det. Hälsningens första kort
  pekar på NexLäx när passen är av, NexLäx säger att det är avstängt,
  och Profil säger vad barnet får. En tom lista hade sett ut som ett fel.
  Utan `behorigheter` i svaret (en databas före migrationen) är allt på,
  som förut.
- **En ny behörighet** går in i `intern.barn_behorigheter_alla()`,
  villkoret, förvalet (kolumnen och återställningarna i
  `skydda_studentfalt` och `skydda_studentfalt_ny`), `BARN_FÅR` och
  `BARN_FÅR_FÖRVAL` i studievyn och `FÅR` i barnets vy, i samma ändring
  som funktionen den spärrar. `kolla-behorigheter.py` jämför listorna.

## Del 2: adminbehörigheterna

### Sanningen
`admin_roller` (en rad per admin): `ar_superadmin` eller en lista ur nio
behörigheter: `leads`, `matchning`, `anvandare_las`, `anvandare_redigera`
(kräver läs), `studiehjalpare_godkann`, `bokningar_las`, `rapporter_las`,
`notiskonfig`, `admin_hantera`. Listan står i villkoret, i
`intern.admin_behorigheter()`, i `_delad/adminbehorighet.ts` och i
`nextrum-admin-behorighet.js`; `kolla-behorigheter.py` jämför dem.

`profiles.is_admin` finns kvar och SPEGLAR superadmin
(`profiles_spegel_admin` räknar om den vid varje skrivning). Ingen
inloggad kan skriva den (42501). SQL-receptet i START-HÄR fungerar som
förut: `update profiles set is_admin = true` ger en superadmin, `false` tar
bort rollen. `is_admin()` har samma namn, signatur och vakt, men läser
`admin_roller` och är superadmin. Den byttes med en md5-vakt: är
funktionen i driften inte den som stod i main vägrar migrationen.

Dagens admins blev superadmins i migrationen.

### Reglerna, i triggern admin_roller_vakt
- Ingen ändrar sin egen roll.
- Bara en superadmin eller den med `admin_hantera` ändrar roller.
- Bara en superadmin gör någon till superadmin eller rör en superadmin.
- En admin utan superadmin ger bara det hen själv har, och ändrar bara den
  som inte har mer än hen själv.
- Den sista superadminen kan inte tas bort eller nedgraderas (låset tas
  först, så att två samtidiga inte båda ser den andra som kvar).
- Ett barnkonto blir aldrig admin.
SQL (ingen `auth.uid()`) går förbi vem-reglerna men aldrig förbi barnet
eller den sista superadminen. `admin_logg` skrivs av `admin_roller_efter`
och går inte att ändra eller tömma (`admin_logg_las`).

### Vägarna in
- Väg A, en ny person: `admin-skapa`. Frågar `admin_kan_ge()` med
  anroparens token INNAN inbjudan, så att ingen bjuds in till något hen
  sedan nekas. `inviteUserByEmail` med `redirectTo` `https://nextrum.se/admin`
  (ska stå bland Redirect URLs), profilen får `role = 'admin'` (en adress,
  ingen behörighet), och rollen skrivs med `gor_till_admin` och ANROPARENS
  token, så att vakten ser vem som ger den. Säger databasen nej tas kontot
  bort igen. En adress som redan har ett konto får 409 och pekas mot väg B.
- Väg B, en befintlig användare: `gor_till_admin(user_id, behörigheter,
  superadmin)` och `ta_bort_admin(user_id)`, SECURITY DEFINER, direkt från
  vyn.
- Den inbjudna kommer till `/admin` med en inloggning i adressen
  (`type=invite`). `NX.inbjudan` läses innan supabase-js tömmer adressen,
  och adminvyn ber om ett lösenord (`updateUser`). Samma ruta finns under
  Byt lösenord i kontomenyn.

### Policyerna
Superadmin har allt genom `is_admin()`, som förut. Behörigheterna fick egna
policyer bredvid (`behörighet läser personer` och syskonen), och
`leads`- och notispolicyerna byttes till `har_behorighet`. Sex funktioner
som frågade `is_admin()` men hör till en behörighet lappades med
`replace()` och en vakt som räknar träffarna (`skydda_leadfalt`,
`matchningsforslag`, `notis_lage`, `notis_kor_nu`, `notis_provmejl`,
`notisfel`), och `skydda_tutorfalt` släpper igenom `status` och
`visa_publikt` för `studiehjalpare_godkann`. `logga_andring` och
`radering_underlag` känner igen varje adminroll, inte bara superadmin.

Allt annat, betalningar, fakturor, löner, chattar, ansökningar, raderingen,
AI:n, agenterna, tjänsterna och systemet, är superadminens.

### Adminvyn
`nextrum-admin-behorighet.js` läser `mina_behorigheter()` (saknas den:
`is_admin` är allt, som förut). En admin med behörigheter får bara sina
sektioner och flikar (`SEKTIONER`, `FLIKAR`), och det start() ritar och hen
inte behöver byts mot en tom funktion i `NXAdmin.rita`, så att inget område
frågar databasen om det hen ändå inte får läsa. `[data-bara-super]` tas
bort (Tips och kampanjer, som stod under Intresseanmälningar och sedan
2026-10-06 står under Tjänster, som bara superadmin ser). **Knapparna i en
sektion som syns är superadminens**: en admin med `bokningar_las` ser
Avboka, och databasen säger nej. Det är med flit, reglerna står i RLS, men
det är inte snyggt, och nästa steg är att vyn frågar `har()` före varje
knapp.

En admin som också är förälder eller studiehjälpare landar i sin vanliga
vy med länken Adminvy i sidhuvudet (`NXStudie.adminroll`). Ett konto som
bara är admin (`profiles.role = 'admin'`) skickas från studievyn och
studiehjälparvyn till `/admin`.

## Driften (2026-09-30)
- Migrationerna `20261001000000_barnkonton_och_admin` och
  `20261001000200_barnkonto_skapas_genom_auth` är körda, med sina rader i
  `schema_migrations` (texten hämtad från merge-commiten och prövad mot
  sin md5). Båda torrkördes först med hela `rls-test.sql` i en
  transaktion som rullades tillbaka: 1139 av 1139 och sedan 1151 av 1151.
  Dagens superadmin blev superadmin i `admin_roller`.
- `barn-konto` (v2) och `admin-skapa` (v1) är driftsatta från main och
  hämtade tillbaka, lika med main. `notis-ko` är inte omdriftsatt; se
  `minne/funktioner.md`.
- **Kedjan provad mot riktiga Auth**, med en testförälder på
  `example.com` och ett testbarn, genom tillägget `http` från databasen
  (containern når inte `supabase.co`): förälderns token till `barn-konto`,
  barnets inloggning genom `/auth/v1/token` och barnets anrop genom
  PostgREST. Första försöket visade felet som rättelsen fixar (500 vid
  skapandet). Efter rättelsen gick alla 36 stegen som väntat: skapa (400
  utan vårdnadshavarens ja, 200 med), kontot med `role nextrum_barn`,
  `app_metadata` ur fönstret, hash `$2a$10$`, mejlspärren och fönstret
  stängt; barnet in två gånger i rad; barnets funktioner svarar och
  tabellerna nekar; `admin-skapa` och `barn-konto` nekar barnet (403);
  barnets eget lösenordsbyte i Auth nekas (500, "Barnets lösenord byts av
  föräldern i studievyn") och det gamla gäller; `/recover` svarar 429 och
  Auths logg visar inget mejl; `admin-skapa` nekar en förälder (403);
  föräldern byter lösenordet (det gamla slutar gälla, mejlspärren står
  kvar), pausar (inloggningen nekas som `user_banned`, sessionerna är
  borta, en redan utlämnad token får `pausad`), aktiverar och tar bort
  (kontot borta, användarnamnet tomt, inga fönster och inga notiser
  kvar). Testfamiljen är borttagen; kvar finns bara auditloggens rader
  med id:n (4 för barnet, 4 för uppdraget), som inte går att ta bort.
- **Inte provat skarpt**: en inbjudan genom `admin-skapa` (den skickar ett
  riktigt mejl och kräver en superadmins token), och vyerna mot driften
  (webbläsarprovet går mot en falsk Supabase, och containern når inte
  sajten). Vyerna skickar samma anrop som kedjeprovet.
- Lösenorden i provet stod i SQL-satserna, och **driftens Postgres-logg
  sparar satserna som körs genom MCP**. Kontona är borttagna, men lägg
  aldrig en riktig hemlighet i en sats som körs så.

## Proven
- `verktyg/rls-test.sql`, avsnittet BARNKONTON OCH ADMIN MED BEHÖRIGHETER:
  barnet med och utan rätt `app_metadata`, slingan över alla tabeller och
  vyer, katalogens rättigheter, listan över SECURITY DEFINER-funktioner
  barnet når, `auth.users`-spärrarna (adress, återställning, lösenord med
  och utan fönster, ett fönster som bara räcker en gång, ban och
  inloggning går igenom), varje adminregel, loggen som inte går att ändra,
  och att en barnadress aldrig tas ut ur mejlkön. Avsnitt 7b (rättelsen):
  kontot skapat i GoTrues ordning, en registrering på samma adress medan
  fönstret är öppet, fel användarnamn, fel familj och ett utgånget fönster,
  fönstrets villkor, och mejlspärren (står på, överlever ett lösenordsbyte
  som Auth gör det, går inte att flytta bakåt, rör inte vanliga konton).
  Hela filen var grön (1151 rader) mot en lokal databas med alla 154
  migrationer, och utan rättelsen föll 16 av dem. Avsnitt 14 (NexLäx i
  barnets vy, 2026-10-01): barnet läser sin bana, startar, svarar, ser
  rättningen och läget, bockar av en vanlig uppgift men inte en digital,
  och gör inget av det åt ett annat barn, med fel familj i token eller med
  en pausad inloggning; 1173 rader gröna lokalt. Avsnitt 15 (barnets egen
  e-post, 2026-10-01): 47 prov för förälderns funktioner, vem som inte når
  tabellen, koden, uppslaget och båda taken, barnets val, kön och
  omprövningen, avanmälan, gallringen och flaggan av; 1220 rader gröna
  lokalt, och de som ska falla föll när tabellen öppnades.
- `rls-test.sql` avsnitt 22 (barnets behörigheter, 2026-10-06): 40 prov
  för förvalet, förälderns läsning och sparande, auditloggen, varje
  spärr i barnets funktioner (också rapportknappen och tråden, från båda
  hållen), familjens NexLäx med barnets av, och vem som inte får ändra
  valet. Hela filen 1433 av 1433 lokalt med alla migrationer, barnets_chatt
  före; utan den här föll bara blocket (1393 av 1394).
- Deno: `_delad/barnkonto_test.ts`, `_delad/adminbehorighet_test.ts`,
  `_delad/barninloggning_test.ts`, `notiser/barn_test.ts`, och barnets
  rader i `notiser/ko_test.ts`, `token_test.ts`, `avanmal_test.ts` och
  `typer_test.ts` (308 prov).
- Webbläsaren: `verktyg/prova-barnkonton.js` (200 prov, gröna), mot en
  falsk Supabase på en adress som inte finns: barnets inloggning och vy i
  ljust, mörkt och på telefon, text ur databasen som text, att barnet bara
  frågar sina egna funktioner, NexLäx i barnets vy (vägen, en nivå spelad
  hela vägen med barnets id, bocken, Din utveckling utan bedömning, och
  telefonen), e-post eller användarnamn i alla fyra
  inloggningarna och den tekniska adressen som nekas (2026-10-01; de nya
  proven föll mot koden före, med samma anrop som i driften),
  föräldrarnas ruta, barnets egen e-post (förälderns del, barnets
  inställningar, länken i bekräftelsen och inloggningen med adressen, i
  dator och telefon), och adminvyn för en superadmin, en begränsad admin,
  en utan roll och en inbjuden. Se `minne/genererat-och-ci.md`.
