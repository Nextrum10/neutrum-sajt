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
- Barnet loggar in på `/barn` med användarnamnet. Adressen byggs i
  webbläsaren och barnet ser den aldrig. Felet är alltid "Fel användarnamn
  eller lösenord", utom när nätet inte svarar eller Supabase säger 429 för
  många försök; inget av dem säger något om vilka användarnamn som finns.
- **Också i studievyns inloggning (2026-10-01).** Det första riktiga
  barnkontot gick inte att logga in med. Logga in på sajten leder till
  studievyn ("Förälder eller elev"), där fältet hette E-post och ett
  användarnamn fick "Fel e-post eller lösenord", och `/barn` nås bara om
  man skriver adressen; ingen länk dit, och ingen från `/barn` till
  föräldervyn. Auths logg visade två nekade försök minuten efter att
  kontot skapats. Nu heter fältet "E-post eller användarnamn" när man
  loggar in, och ett användarnamn eller en hel barnadress loggas in som
  på `/barn` och skickas dit; en adress med @ på en annan domän är en
  vuxen, som förut. Båda vyerna går genom `NXStudie.barnAdress` (regeln
  ANVANDARNAMN) och `NXStudie.loggaInBarn` (beskeden och kollen att
  kontot är ett barn), och familjens uppgifter hämtas aldrig med barnets
  inloggning. Glömt lösenordet i studievyn ger ett användarnamn samma
  besked som en barnadress. Studiehjälparvyn och adminvyn tar inga
  användarnamn: där är ett ord utan @ en ofullständig adress.

### Rollen nextrum_barn, och varför en egen roll
Det stod i uppdraget att allt för barnet ska vara stängt som förval. Två
vägar fanns: en policy per tabell som säger nej till barn (och en ny tabell
som glömmer policyn är öppen), eller en egen Postgres-roll som inte har
några rättigheter alls. Vi valde rollen. PostgREST byter till rollen i
tokens `role`-anspråk, som GoTrue sätter från `auth.users.role`.
`authenticator` är medlem i `nextrum_barn`, och rollen har `usage` på
`public` och EXECUTE på exakt tre funktioner: `barn_oversikt()`,
`barn_notiser()` och `barn_markera_last(id)`. `rls-test.sql` prövar det
med en slinga över varje tabell och vy, och med katalogen
(`has_table_privilege`, `has_function_privilege`).

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
`notis_vid_pass`. **Barnet får aldrig ett mejl**: `notis_utskick_ta`
hoppar över barnkonton och barnadresser, och `notis-ko` gör det en gång till
(`arBarnadress`). `notis_konfig.lage` rördes inte. Gallras efter 180 dagar
(`barnkonton-gallring`, 03.59 UTC).

### Vyerna
- `barn.html` + `nextrum-barn-vy.js`: bara NX och NXStudie (ingen
  kontakt, ingen betalning, ingen bokning), skarp CSP (`/barn` i
  `vercel.json`), `noindex` och `Disallow` i `robots.txt`. Ingen länk till
  föräldervyn och ingen kontoinställning; "Vill du ändra något? Fråga din
  förälder." Allt ritas med `textContent`.
- En vuxen som är inloggad i samma webbläsare och öppnar `/barn` ser bara
  "Någon annan är inloggad" och Logga ut, aldrig sin egen vy därifrån.
- Rolldirigeringen: `NX.ärBarn(user)` läser `app_metadata`, aldrig
  `user_metadata`. `NX.skickaBarnHem()` i studievyn, studiehjälparvyn och
  adminvyn. Det är bara rätt sida; skyddet är rollen i databasen.
- Föräldrarnas ruta: `mina_barnkonton()` (tål att migrationen saknas:
  PGRST202 döljer rutan), `visa_rapporter` skrivs direkt på `students`
  och bara föräldern får ändra den (`skydda_studentfalt`). Klasserna heter
  `bi-*` och data-attributen `data-bi-*`; `bk-*` är bokningens.
- Felrapporterna (`nextrum-fel.js`) når inte fram från ett inloggat barn:
  rollen får inte skriva i `klientfel`. Det är med flit (inga rättigheter),
  men det betyder att fel i barnets vy bara syns före inloggningen.

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
bort (Tips och kampanjer under Intresseanmälningar). **Knapparna i en
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
  migrationer, och utan rättelsen föll 16 av dem.
- Deno: `_delad/barnkonto_test.ts`, `_delad/adminbehorighet_test.ts` och
  ett nytt prov i `notiser/ko_test.ts`.
- Webbläsaren: `verktyg/prova-barnkonton.js` (119 prov, gröna), mot en
  falsk Supabase på en adress som inte finns: barnets inloggning och vy i
  ljust, mörkt och på telefon, text ur databasen som text, att barnet bara
  frågar sina tre funktioner, barnets inloggning i studievyn (2026-10-01;
  nio av de nya proven föll mot koden före), föräldrarnas ruta, och
  adminvyn för en superadmin, en begränsad admin, en utan roll och en
  inbjuden. Se `minne/genererat-och-ci.md`.
