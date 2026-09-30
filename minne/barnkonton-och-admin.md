# Barnens inloggning och adminbehörigheterna (barnkonton_och_admin, 2026-09-30)

Läses när arbetet rör barnets vy (`barn.html`), föräldrarnas ruta Barnens
inloggning, adminrollerna eller adminvyns System → Adminhantering. Reglerna
står i `CLAUDE.md`; här står varför och fällorna.

Allt kom i en migration, `supabase/migrations/20261001000000_barnkonton_och_admin.sql`,
med två edge-funktioner (`barn-konto`, `admin-skapa`) och deras rena delar i
`_delad/barnkonto.ts` och `_delad/adminbehorighet.ts`. Versionen i filnamnet
är gissad: den som kör migrationen döper om filen till den version
`apply_migration` registrerar (`kolla-migrationer.py`).

## Del 1: barnets inloggning

### Hur ett barn kommer in
- Föräldern skapar inloggningen i studievyn (Profil & inställningar → Barn,
  rutan Barnens inloggning): användarnamn, lösenord två gånger och en
  kryssruta där föräldern bekräftar att hen är vårdnadshavare och godkänner
  att barnet använder Nextrum, med länk till `/integritetspolicy#barn`.
- `barn-konto` prövar föräldern med ANROPARENS token (barnet läses genom RLS,
  sedan `parent_id = anroparen`) och skapar kontot med `service_role`:
  adressen `<användarnamn>@barn.nextrum.se`, `email_confirm`, `app_metadata
  {roll: 'barn', forald_id, barn_id}` och `role: 'nextrum_barn'`.
- Barnet loggar in på `/barn` med användarnamnet. Adressen byggs i
  webbläsaren och barnet ser den aldrig. Felet är alltid "Fel användarnamn
  eller lösenord", utom när nätet inte svarar eller Supabase säger 429 för
  många försök; inget av dem säger något om vilka användarnamn som finns.

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

Att det fungerar mot riktiga Supabase är INTE provat. Lokalt (Postgres i
Docker, samma roller) går `set role nextrum_barn` och PostgREST-mönstret.
På den hostade Supabase ska någon, efter migrationen, logga in som ett
barn och se att `barn_oversikt` svarar och att `from('students')` ger
`permission denied` (`DEPLOY-BARNKONTON.md`).

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

### Auth: vad som spärras i auth.users
Tre triggrar på `auth.users`:
1. `auth_barnkonto_skapas` (BEFORE INSERT): en adress på barndomänen måste ha
   `roll = barn`, och `roll = barn` måste ha en giltig adress, ett barn med
   förälder och inget konto sedan tidigare. Sätter `role = nextrum_barn` och
   tömmer `user_metadata`. Så går det inte att registrera sig själv på
   domänen genom `signUp`.
2. `auth_barnkonto_kopplas` (AFTER INSERT): sätter `students.user_id`.
3. `auth_barnkonto_las` (BEFORE UPDATE): för ett barn kan `app_metadata.roll`,
   `barn_id` och `forald_id` inte ändras, rollen tvingas tillbaka, och adress,
   `email_change`, token för återställning och byte, och telefonen går inte
   att röra. Lösenordet (`encrypted_password`) går bara att ändra när
   `barn_andringsfonster` har en öppen rad för barnet, högst 60 sekunder
   gammal, och raden förbrukas. Allt annat GoTrue skriver (senaste inloggning,
   `banned_until`, `updated_at`) går igenom; `senast_inloggad` följer med till
   `students` i ett eget undantagsblock, så att ett fel där aldrig stoppar en
   inloggning.

`handle_new_user` ger inget föräldrakonto till ett barn (`roll = barn` går
förbi den).

Fällor, provade lokalt men inte mot riktiga GoTrue:
- **GoTrue skickar ett återställningsmejl INNAN token sparas.** Spärren
  hindrar att token sparas, så länken fungerar aldrig, men GoTrue kan ha
  hunnit försöka skicka. Adressen kan inte ta emot post, och en null-MX
  på `barn.nextrum.se` gör det säkert (DEPLOY-filen).
- **Ett 500-svar från `/recover`** kan i teorin skilja ett barnkonto från en
  adress som inte finns. Domänen är känd ändå (användarnamnet är inte
  hemligt), så risken är liten, men den står här.
- **Skriver GoTrue om hashen vid en inloggning** (kryptering av hasharna
  eller byte av algoritm, inget av det är på som förval) är det en ändring
  av `encrypted_password` utan fönster. Triggern säger nej, och barnet kommer
  inte in. Den går inte att skilja från ett försök att byta lösenordet, så
  den släpps inte igenom. Prova i driften att ett barn kan logga in två
  gånger i rad, och slå inte på hashkrypteringen i Auth utan att tänka på
  det här.
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

## Proven
- `verktyg/rls-test.sql`, avsnittet BARNKONTON OCH ADMIN MED BEHÖRIGHETER:
  barnet med och utan rätt `app_metadata`, slingan över alla tabeller och
  vyer, katalogens rättigheter, listan över SECURITY DEFINER-funktioner
  barnet når, `auth.users`-spärrarna (adress, återställning, lösenord med
  och utan fönster, ett fönster som bara räcker en gång, ban och
  inloggning går igenom), varje adminregel, loggen som inte går att ändra,
  och att en barnadress aldrig tas ut ur mejlkön. Hela filen var grön
  (1139 rader) mot en lokal databas med alla 152 migrationer.
- Deno: `_delad/barnkonto_test.ts`, `_delad/adminbehorighet_test.ts` och
  ett nytt prov i `notiser/ko_test.ts`.
- Webbläsaren: `verktyg/prova-barnkonton.js` (96 prov, gröna), mot en
  falsk Supabase på en adress som inte finns: barnets inloggning och vy i
  ljust, mörkt och på telefon, text ur databasen som text, att barnet bara
  frågar sina tre funktioner, föräldrarnas ruta, och adminvyn för en
  superadmin, en begränsad admin, en utan roll och en inbjuden. Se
  `minne/genererat-och-ci.md`.
