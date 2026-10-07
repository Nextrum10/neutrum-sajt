# Säkerhetsmodellen

Arkivet för avsnitt 6 i `CLAUDE.md`, ordagrant. Reglerna står i kärnan, `CLAUDE.md`; här står
varför, historien och proven. "Den här filen" i texten är `CLAUDE.md` före delningen, och
"avsnitt N" är kärnans.

---

## 6. Säkerhetsmodellen

Den här är inte förhandlingsbar och förklarar större delen av koden.

Dataskyddet på pappret (registret över behandlingar,
konsekvensbedömningen, incidentrutinen och biträdena) står i
`DATASKYDD.md`. **Ändras vad som sparas, till vem det går eller hur
länge: ändra `DATASKYDD.md` och integritetspolicyn på båda språken i
samma ändring.**

Det som skickas till Anthropic från rapportutkasten och hälsningarna
går genom `_delad/minimera.ts`: förnamnet, och fritext där
personnummer, telefonnummer och e-post är maskade. Samma regler som
`maska_kontakt()` i databasen; ändras den ena ska den andra ändras.

**Allt skydd ligger i RLS. Ingenting ligger i gränssnittet.**
Adminvyn hämtar med samma anon-nyckel som alla andra. Att gömma en
knapp är inte säkerhet — den som inte är admin får tomma svar oavsett
vad filen ritar. `is_admin`-kontrollen i `nextrum-admin.js` finns för
att visa **rätt sida**, inte för att skydda data.

- **Rå servertext visas bara i de inloggade vyerna.** `NX.felText`
  kände igen sex fel och skrev annars ut serverns egen text. På
  `body.vy` (admin, larare, foralder) är det rätt — den som läser är
  vi själva, och "new row violates row-level security policy for table
  bookings" är svaret på frågan. På en publik sida är det fel två
  gånger om: föräldern förstår den inte, och den beskriver en tabell
  och en policy för vem som helst. Sedan Fas 14.0 går den texten till
  konsolen och `klientfel` i stället, och besökaren får ett begripligt
  besked med en adress att mejla. **Varje meddelande som slutar i en
  återvändsgränd ska bära `{oss}`** — `t()` fyller den med `CFG.EPOST`
  utan att anroparen behöver veta om det. Förut stod "Fyll i
  nextrum-config.js" ordagrant på den publika intresseanmälan, och en
  familj som fick det hade ingen väg vidare alls.
- **anon-nyckeln är inte hemlig.** Den hör hemma i webbläsaren.
- **`service_role` får aldrig in i en klientfil.** Den går förbi RLS.
- **I edge functions: anroparens egen token prövas mot Auth och RLS
  INNAN `service_role` används.** En kontroll som ligger efter
  `service_role` är ingen kontroll. `_delad/auth.ts` har en väg per
  fråga — uppfinn inte en ny.
- **Ett CHECK-villkor körs som ANROPAREN, inte som tabellägaren.**
  Dyrköpt i Fas 10: en `revoke execute` på `tjanstkoder_finns`, som
  backar `applications_tjanster_check`, slog sönder hela
  ansökningsvägen med `permission denied`. Ska en funktion som backar
  ett villkor sluta vara nåbar utifrån, FLYTTA den ur `public` i
  stället — schemat `intern` finns för just det, och PostgREST
  exponerar det inte. Ett rullat prov fångade det; utan provet hade
  rekryteringsformuläret tystnat i drift.
- **Postgres RLS kan inte begränsa enskilda kolumner.** Därför vaktas
  `is_admin`, `matched_tutor_id`, `status` och bokningsfälten av
  **triggers** som vägrar ändringen från en inloggad session. Det går
  inte att göra sig själv till admin från någon vy, med flit.
  Sedan barnkonton_och_admin (2026-09-30) är `admin_roller` sanningen och
  `is_admin` en spegel av superadmin. Admin ges under System →
  Adminhantering (`gor_till_admin`, `ta_bort_admin`, `admin-skapa`), av en
  superadmin eller den med `admin_hantera`, eller med SQL, som ger en
  superadmin:
  ```sql
  update public.profiles set is_admin = true where email = '…';
  ```
  Reglerna (ingen ändrar sig själv, ingen ger det den inte har, den sista
  superadminen står kvar, ett barn blir aldrig admin) står i triggern
  `admin_roller_vakt`; se `minne/barnkonton-och-admin.md`.
- **Barnets inloggning har en egen Postgres-roll**, `nextrum_barn`, utan
  en enda tabellrättighet. Barnet når bara sina egna funktioner (listan
  står i `rls-test.sql`), och
  `auth.users` har triggrar som spärrar barnets adress, återställning och
  lösenord (utom i föräldrarnas fönster). Se `minne/barnkonton-och-admin.md`.
- **Barnets egen e-post når aldrig Auth** (barnets_epost, 2026-10-01). Den
  står i `barn_epost`, som ingen inloggad har några rättigheter till, och
  inloggningen med den går genom `barn-inloggning`: databasen slår upp den
  tekniska adressen (bara `service_role`) och räknar försöket per adress
  och IP-nummer som en HMAC med `notis_konfig.barn_nyckel`, innan Auth
  prövar lösenordet. Samma besked och minst 0,9 sekunder för varje nej, så
  att varken svaret eller tiden säger vilka adresser som är barnens. Ett
  misslyckat vuxeninlogg med @ provas också som barnadress
  (`NXStudie.loggaIn`): lösenordet passerar då vår funktion, loggas aldrig
  och når bara Auth om adressen är ett barns. Bekräftelsekoden är en HMAC
  som inte sparas, och den jämförs som hash.
- **`invoices` och `payouts` har med flit ingen INSERT-policy för
  användare.** Kan ingen skriva belopp från webbläsaren kan ingen
  skriva fel belopp. Beloppen sätts av `fakturering` med `service_role`.
- **`integrationer` har ingen skrivpolicy alls.** Adminvyn rapporterar
  status. Koppla Google (Fas 18.1) skickar bara admin till Google:
  engångskoden kommer tillbaka till `google-koppla`, byts mot en nyckel
  där, med klienthemligheten, och nyckeln ligger i `google_koppling`,
  som ingen inloggad ser, inte ens admin.
- **Hinkarna är privata, och sökvägen är ett uuid — aldrig ett namn.**
  `material` har elevens id som mapp, `dokument` (Fas 9.10) har
  handlingens, `bibliotek` (Fas 13.2) har materialradens. Ett filnamn heter i praktiken "Avtal Alva Berg 2026.pdf",
  och sökvägen är det enda i en hink som syns innan man öppnat filen.
  `mapp_uuid()` plockar ut den, och policyerna jämför den mot en rad.
  Fas 9.1 rättade att familjegrenen i materialpolicyn jämförde elevens
  NAMN med ett uuid, eftersom `storage.objects.name` skuggades av
  tabellaliaset — familjen hade alltså aldrig kunnat se sitt barns
  material, och en policy som nekar för mycket ser ut som en tom lista,
  inte som ett fel.
- **`dokument` släpper in en person till en fil** (2026-09-29): den som
  en handling delats med läser filen raden pekar ut, prövat på HELA
  sökvägen och inte bara mappen (`intern.handling_delad_med_mig`,
  SECURITY DEFINER eftersom personen inte ser `handlingar`). Läsa, inget
  annat: uppladdning, byte och borttagning är fortfarande admin ensam.
  Ett avtal som klistrats in som text (2026-10-05) ligger i
  `handlingar.innehall`, inte i hinken, och personen läser det bara
  genom `min_handling_text()`, samma prövning som filen.
- **`cv` är undantaget** (v11, läsrätten 2026-09-27). Den som söker
  har inget konto och ingen rad när filen laddas upp, så sökvägen är
  tid, slump och filnamnet, och kopplingen till ansökan är raden
  `CV: cv/<sökväg>` som `NX.kopplaAnsökan` skriver i
  `applications.why`. Anon laddar upp, bara admin läser
  (`admin läser cv`). Hinken hade ingen läsregel alls förut, så CV:t
  kom fram men gick bara att öppna i dashboarden. Knappen CV under
  Ansökningar läser raden med `CV_RAD` i `nextrum-admin-rekrytering.js`:
  **ändras formatet i den ena ska den andra ändras i samma ändring**,
  annars försvinner knappen utan att något blir rött. En PDF öppnas i
  en ny flik med en länk som gäller fem minuter, och fliken öppnas i
  samma tryck: Safari stoppar tyst ett fönster som öppnas efter en
  väntan på nätet. Word hämtas som en blob och laddas ned. PDF:en kan
  inte gå den vägen, för en blob-adress ärver adminvyns CSP och
  `object-src 'none'` stoppar PDF-visaren. Filen och ansökan gallras
  efter ett år (avsnitt 5, Gallringen).
  **Uppladdningen har ett tak** (2026-09-29): policyn släpper bara in
  sökvägen `NX.kopplaAnsökan` bygger (13 siffror, slump, rensat
  filnamn) och högst tjugo filer i timmen
  (`intern.cv_uppladdning_tillaten()`). Nekas filen går ansökan in
  ändå, med filnamnet noterat. **Ändras sökvägens form i
  `kopplaAnsökan` ska policyn ändras i samma ändring**, annars kommer
  inget CV fram och ingenting blir rött.
- **Det anonyma har tak** (2026-09-29). `klientfel` kapas i databasen
  till samma längder som `nextrum-fel.js` skickar, och över sextio rader
  på en minut tas raden tyst bort (`intern.klientfel_tak()`).
  `contact_messages` har längder på fälten (formulärets `maxlength`
  följer dem) och nekar över trettio meddelanden i timmen eller tre
  från samma adress (`intern.kontakt_broms()`). Båda sätter
  `created_at` själva, som `leads` och `applications`. Bromsens egen
  text når inte besökaren: en publik sida visar aldrig serverns text
  (`NX.felText`), så formuläret säger "Något gick fel. Prova igen,
  eller mejla oss på …".
  Taken här, länken i biblioteket (avsnitt 5) och CV-hinkens tak ovan
  kom i migrationen `anonyma_skrivningar_far_tak`. Den mergades med
  PR #122 men kördes i driften först samma förmiddag, efter schemats,
  som version `20260929094311`, och det driften sparade har samma md5
  som filen. Fram till dess beskrev den här filen taken som om de
  gällde. `rls-test.sql` har avsnittet Det anonyma har tak: 809 av 811
  med migrationen inläst före körningen och lika efter, där de två är
  Fas 23.1:s prov, och utan migrationen föll elva av avsnittets femton.
- **Tar du bort en fil: filen först, raden sedan, och LÄS SVARET.**
  Sökvägen finns bara i raden. Försvinner raden först blir filen omöjlig
  att hitta och omöjlig att städa. Det stod som en kommentar i
  adminvyn långt innan koden faktiskt gjorde det (Fas 9.2). För
  ansökningarna vaktar databasen ordningen: `ansokan_gallra()` tar inte
  bort raden medan filen finns.
- **Notishemligheten ligger i `notis_konfig`, inte i en secret.** En
  secret och en webhook-header i två olika fönster glider isär, och då
  svarar funktionen 401 på varje anmälan emellan — de mejlen kommer
  aldrig. I en tabell byts båda i samma transaktion.

### Inloggningen i vyerna (2026-09-29)

Leo: "kontroller i admins inställning i automationer går inte att
köra". Kontrollerna var hela, provkörda som admin i databasen. Det var
adminvyn som var utloggad utan att veta om det, och båda felen satt i
vyerna:

- **Logga ut gäller bara den enheten** (`NXStudie.loggaUt()`,
  `scope: 'local'`). supabase-js `signOut()` tar som förval bort ALLA
  personens sessioner, på alla enheter. Auth-loggen visade mönstret
  flera gånger samma dygn: en utloggning på en enhet, och på en annan
  "Refresh Token Not Found" nästa gång den skulle förnya. Senast
  loggade telefonen ut klockan 00:59, och adminvyn på datorn tappade
  inloggningen när datorn vaknade på morgonen. Ska någon loggas ut
  överallt (en förlorad dator, incidentrutinen i `DATASKYDD.md`) görs
  det i databasen, som `radera_person()` gör: `delete from
  auth.refresh_tokens where user_id = '<id>'` och `delete from
  auth.sessions where user_id = '<id>'`. En access-token som redan
  lämnats ut gäller tills den går ut, ungefär en timme.
- **En vy som tappat inloggningen visar inloggningen**
  (`NXStudie.vaktaInloggningen()`, i alla tre vyerna). Nekar Auth
  förnyelsen tar supabase-js bort sessionen och säger `SIGNED_OUT`,
  och varje fråga därefter går med den publika nyckeln, som anon.
  Ingen vy lyssnade: adminvyn stod kvar med gårdagens listor, räknarna
  i sidhuvudet blev noll utan fel (RLS ger anon noll rader), och
  knappen svarade "permission denied for function kor_kontrollerna".
  Nu byts vyn mot inloggningen, med ett besked och adressen ifylld, och
  efter inloggningen öppnar vyn där man var. Loggar någon annan in i
  samma webbläsare laddas vyn om: sessionen är delad mellan flikarna,
  och adminvyn hade annars fortsatt fråga med den personens token.

**Säger en inloggad vy "permission denied" eller visar tomma listor,
titta i API-loggen först** (`edge_logs`). Står den publika nyckeln i
`request.sb.apikey.authorization.prefix` (`sb_publishable_…`) i stället
för en JWT med `request.sb.jwt.authorization.payload.subject` gick
anropet utloggat, och felet sitter i sessionen, inte i policyn eller
funktionen.

### Glömt lösenordet (2026-09-30)

Leo: "reset password står på engelska". Mallen gick att översätta, men
ingen vy kunde be om mejlet: den som glömt sitt lösenord hade ingen väg
tillbaka utom att mejla oss, och vi hade fått skicka länken från
Supabase-panelen. Nu har inloggningen i studievyn, studiehjälparvyn och
adminvyn en knapp, **Glömt lösenordet?**, som byter rutan till ett läge
med bara e-postfältet (`NXStudie.inloggningsruta(… 'glomt' …)`,
`glömtSkicka()`). Barnens vy har ingen: där står sedan förut att
föräldern byter lösenordet.

- **Länken leder tillbaka till vyn där man bad om den**
  (`resetPasswordForEmail(epost, { redirectTo: vyns adress })`). Auth
  tillåter `/foralder`, `/larare`, `/admin` och `/barn` som redirect
  (provat mot driften 2026-09-30: `verify` med en ogiltig token skickade
  tillbaka till varje väg, och till Site URL för en främmande adress).
  En adress som inte är tillåten, eller ett mejl skickat från
  Supabase-panelen, landar på Site URL, alltså startsidan.
  `nextrum-app.js` skickar det vidare till `/foralder` med adressen orörd,
  och skapar med flit ingen klient på startsidan: den hade loggat in där
  och tömt adressen innan den nya sidan hann öppnas.
- **`type=recovery` läses innan klienten skapas** (`NX.återställning`,
  samma mönster som `NX.inbjudan`): supabase-js loggar in med länken och
  tömmer adressen, och efter det syns inte att personen kom från ett
  återställningsmejl. Vyn frågar då efter ett nytt lösenord
  (`NXStudie.nyttLösenord()`, minst 6 tecken som i profilen, 8 i
  adminvyn) direkt efter `skickaBarnHem`, och **rutan väntas in före
  rolldirigeringen**: ett konto som bara är admin skickas annars till
  `/admin` mitt i rutan. Rutan stänger inte av ett tryck utanför, och
  Inte nu stänger utan att spara; lösenordet går att byta i profilen
  senare.
- **En inbjudan ber om ett lösenord i alla tre vyerna** (2026-10-01).
  `bjud-in` bjuder in familjer till `/foralder` och studiehjälpare till
  `/larare`, men bara adminvyn frågade efter ett lösenord
  (`NX.inbjudan`): en familj som bjudits in ur en intresseanmälan blev
  inloggad av länken en gång och hade sedan inget lösenord att logga in
  med. Nu öppnar `type=invite` samma ruta i studievyn och
  studiehjälparvyn, med inbjudans text (`nyttLösenord(…, { inbjuden })`),
  och en inbjudan som landar på startsidan skickas vidare till
  studievyn, som en återställning gör. Adminvyn behåller sin egen ruta
  (`väljLösenord`). Sedan 2026-10-06 går rutan inte att stänga för ett
  konto vi skapat (Konton vi skapar, nedan).
- **Samma besked oavsett konto.** Auth svarar likadant för en adress som
  inte finns, och rutan gör det också: "det finns inget konto med den
  adressen" hade svarat på vem som är kund hos oss, för vem som helst.
  429 med "only request this after N seconds" betyder att samma adress
  fick en länk för mindre än en minut sedan, och får samma besked. Det
  gemensamma taket för mejl ("Email rate limit exceeded") får ett ärligt
  besked, för då har inget mejl gått. Ingen servertext visas; felet står
  i konsolen.
- **En barnadress** (`@barn.nextrum.se`) får beskedet att föräldern byter
  lösenordet, utan anrop. Auth hade ändå inte skickat något
  (`barnkonto_mejlsparr`). Det gäller också ett användarnamn utan @, i
  alla vyer, för varje inloggning tar e-post eller användarnamn
  (2026-10-01, `minne/barnkonton-och-admin.md`).
- **En länk som gått ut eller redan använts** kommer tillbaka med
  `#error_code=otp_expired` i stället. `nextrum-app.js` tar felet ur
  adressen innan klienten ser det (adminvyn och studievyn läser adressen
  som en sektion), och vyn öppnar Glömt lösenordet med förklaringen
  överst (`NX.länkfel`, `NXStudie.länkenGickInte()`). Samma sak när
  länken inte gick att logga in med.
- **Mejlet kräver egen SMTP, och den är på.** Supabases inbyggda mejl
  går bara till medlemmarna i organisationen i Supabase. För alla andra
  svarar Auth `email_address_not_authorized`, och rutan säger att mejlet
  inte gick att skicka; för en adress utan konto svarar Auth 200 som
  vanligt, så skillnaden hade också avslöjat vilka konton som finns.
  Provat 2026-10-01 med en registrering till en plusadress (som ingen
  medlem har): Auth svarade 200, mejlet låg i inkorgen efter en sekund,
  och provkontot togs bort. Auth skickar genom Googles SMTP som
  info@nextrum.se, inte genom Resend: mejlen syns också under Skickat i
  den inkorgen. Inställningen står under Authentication → Emails → SMTP
  Settings.
- **Mallen** (Reset password) står under Kontomejlen nedan.
- Provas i `verktyg/prova-aterstallning.js` (`minne/genererat-och-ci.md`).

### Konton vi skapar, och första inloggningen (2026-10-06)

Leo: "när vi tar in anställde eller familjen till plattformen, används
deras mail iställer och deras lösenord blir "12345678", sedan får de
länk i mailet ... När de loggar in för första gången står det skapa nytt
lösenord och bekräfta lösenordet." Och efter lösenordet en introduktion,
med Fortsätt sist.

- **Inget gemensamt startlösenord, med flit.** Ett lösenord som alla nya
  konton delar kan vem som helst som hört talas om det använda före
  personen själv, med bara adressen, och kontot är en familjs barn, pass
  och betalningar. Att bytet krävs först avgör vyn, och en vy skyddar
  ingenting (avsnitt 6). Det hade också gjort meningen "Ditt lösenord ser
  vi aldrig" i integritetspolicyn osann. Personen gör samma steg med en
  länk: mejlet, ett tryck, lösenordet två gånger. Länken gäller en gång
  och bara för den som har inkorgen.
- **Kontot skapas av `bjud-in`** (Ta in familjen på en anmälan, Ta in i
  poolen på en ansökan; `minne/funktioner.md`) utan lösenord och med
  `user_metadata.valkommen = 'losenord'`. Länken loggar in personen, och
  `NXStudie.lösenordFörst()` öppnar rutan (`nyttLösenord` med `tvingad`):
  inget Inte nu, Escape gör ingenting, och Logga ut står kvar så att den
  som måste gå inte är fast. Lösenordet sparas med `valkommen: 'intro'` i
  samma `updateUser`.
- **Välkomsten följer kontot, inte webbläsaren**: den som stänger fliken
  får rutan igen vid nästa inloggning, på vilken enhet som helst, och
  `NX.inbjudan` ger den också utan metadatan. `'intro'` visar
  introduktionen (`NXStudie.introduktion`, `NXIntro`), och Fortsätt tar
  bort välkomsten. Den som registrerar sig själv får `'intro'` vid
  registreringen. `user_metadata` skriver personen själv: välkomsten säger
  bara vad vyn visar först, och får aldrig avgöra vad någon får.
- **Skicka inbjudan igen** (personens panel i adminvyn, tills hen loggat
  in): ett obekräftat konto får en ny inbjudan; ett bekräftat utan valt
  lösenord får länken som Glömt lösenordet ger (Reset password-mallen,
  vars sista mening "Ditt lösenord är detsamma som förut" inte passar
  helt, men inte är fel); ett konto med lösenord får ingenting, för då är
  det Glömt lösenordet? som gäller.
- **Länkens livslängd** är Auths (Authentication → Providers → Email →
  Email OTP Expiration), och den ska stå kvar på förvalet, en timme.
  Panelen går inte att läsa härifrån, så titta där. Inställningen gäller
  varje mejllänk (registrering, inbjudan, återställning) och den
  sexsiffriga kod som Auth skapar till varje länk och tar emot på
  `/verify`, också när mallen bara har länken. Supabase skriver att en
  längre tid ger mer tid att gissa koden, och tillåter som mest ett
  dygn. En utgången inbjudan kostar familjen två tryck: vyn öppnar Glömt
  lösenordet med förklaringen (`NX.länkfel`), den nya länken
  (återställningen bekräftar också ett konto som aldrig bekräftats) ger
  samma ruta utan Inte nu, och Skicka inbjudan igen finns i adminvyn.
  Höj den inte för bekvämlighetens skull utan att väga det.
- **Villkoren**: godkänns sedan 2026-10-07 i en egen ruta efter
  lösenordet, före introduktionen; se Användarvillkoren nedan.
- Provas i `verktyg/prova-intag.js` och `verktyg/prova-aterstallning.js`
  (`minne/genererat-och-ci.md`), och vägarna i `bjud-in` i
  `_delad/inbjudan_test.ts`.

### Användarvillkoren (villkoren_godkanns, 2026-10-07)
Leo: "Fixa den gamla luckan". Ingen godkände användarvillkoren när kontot
skapades, varken den som registrerade sig eller den vi tog in. Villkoren
gällde på pappret, men ingenting visade att någon sagt ja till dem, och
en konsument som aldrig fått frågan har inte ingått avtalet så som
villkoren beskriver det (ångerrätten, betalningen, avbokningen).
- **Ett godkännande är en rad** i `villkor_godkannanden`: kontot, versionen,
  tiden och var (`registrering` eller `inloggning`). Tiden och versionen
  sätts av databasen, aldrig av anropet. Ingen inloggad skriver i tabellen;
  raden kommer från triggern på `auth.users` eller från `godkann_villkor()`,
  som tar `auth.uid()` och prövar att versionen är den gällande (22023
  annars, så att ingen godkänner en version hen inte sett).
- **Registreringen**: kryssrutan i Skapa konto, i studievyn och
  studiehjälparvyn, skickar `villkor: true` i `user_metadata`, och triggern
  skriver raden när kontot skapas, med den version som gäller då. Det är
  user_metadata, som personen skriver själv, men det enda det kan
  åstadkomma är personens eget godkännande. Ett barnkonto får aldrig en
  rad (`app_metadata.roll = 'barn'`): barnet är ingen avtalspart.
- **Alla andra** får rutan vid inloggningen (`NXStudie.villkorFörst`): den
  vi tagit in, efter lösenordet och före introduktionen; den som
  registrerade sig före 2026-10-07; och alla när villkoren ändras, med
  rubriken Användarvillkoren har ändrats. Rutan går inte att stänga, men
  Logga ut finns, och länkarna öppnas i en ny flik så att rutan står kvar.
  Kryssrutan är aldrig ikryssad från början.
- **Databasen kräver det**, för vyn går att gå förbi: `bookings_kraver_villkor`
  nekar den inloggade (familj eller studiehjälpare) som föreslår ett pass
  eller bekräftar en tid utan godkännande, och `klippkort_kraver_villkor`
  ett köp av timmar åt en familj utan (kassan skriver med service_role,
  så det är familjen på raden som prövas). Felet är P0001 med ledtråden
  `villkor` och en mening som vyerna visar som den är. En avbokning, ett
  betalt pass, en rapport, databasens egna jobb och admin stoppas aldrig:
  en familj ska alltid kunna lämna, också den som inte godkänt nya villkor.
- **Versionen** är datumet sist i `anvandarvillkor.html` och står i
  `intern.villkor_version()`. `kolla-villkor.py` håller dem lika (och den
  engelska sidans datum). Ändras villkoren skrivs en migration som byter
  datumet; då får alla frågan igen, och ingen bokar innan den svarat.
  Därför byts datumet bara när villkoren ändras i sak.
- **Admin** ser i personens panel när villkoren godkändes, eller att de
  inte är det (samma behörigheter som läser personer). Saknas tabellen
  står "okänt", aldrig "inte godkända".
- Provas i `rls-test.sql` avsnitt 23 och `verktyg/prova-villkor.js`. I drift
  sedan 2026-10-07 (PR #208); när migrationen kördes hade ingen godkänt
  något, så alla konton får frågan vid nästa inloggning.

### Kontomejlen från Supabase Auth (2026-10-01)

Bekräftelsen av ett nytt konto, inbjudan och återställningen skickas av
Supabase Auth, med mallar i panelen (Authentication → Emails →
Templates), inte av `notis-ko`, och har inte mejlens skal
(`minne/notiser.md`). Panelen saknar historik, så texterna står här, och
förvalen är engelska. Ändras en mall i panelen ändras den här också.

- **Tre mallar skickas av sajten**: Confirm sign up (`signUp` i
  studievyn och studiehjälparvyn), Invite user (`bjud-in` till
  `/foralder` och `/larare`, `admin-skapa` till `/admin`) och Reset
  password (Glömt lösenordet). Magic link, Change email address och
  Reauthentication skickas bara från panelen eller API:t; texterna står
  ändå här, så att inget i panelen är på engelska.
- **Länken går genom `/lank`**: `https://nextrum.se/lank#{{ .ConfirmationURL }}`.
  `{{ .ConfirmationURL }}` står kvar i varje mall med en länk; den bär
  vyns adress (`redirect_to`), och `{{ .SiteURL }}` leder till
  startsidan.
- **Inga villkor på `{{ .Data }}`.** En inbjudan från panelen har ingen
  metadata, och en mall som inte går att fylla i kan stoppa mejlet.
- **Knappen på `/lank` använder länken, inte mejlet** (2026-10-01).
  Länken går att använda en gång, och vissa mejlfilter (Supabase nämner
  Microsoft Defender för Office 365) öppnar varje länk innan personen gör
  det. Länken var då förbrukad, vyn sa att den inte gick att använda, och
  en ny länk gick samma väg. Nu leder mejlet till `/lank`, där Auths länk
  står efter `#`: ett fragment når aldrig servern, och sidan går
  ingenstans förrän knappen trycks. Knappen är en `<button>`, inte en
  `<a href>`, så att ett filter som följer sidans länkar inte kommer åt
  den. `nextrum-lank.js` godtar bara `verify` hos vårt eget Supabase med
  en token, och avkodar en gång: Supabase fyller mallarna med Go:s
  `html/template`, som procentkodar allt efter `#` (i en vanlig href
  blev `&` till `&amp;`, provat samma dag). Sidan har den skarpa CSP:n
  och ingen Supabase-klient. Samma skäl som knappen på `/avanmal`. En kod
  (`{{ .Token }}`) i stället för länken hade skyddat också mot ett filter
  som trycker på knappar, men kostar varje familj sex siffror att skriva
  av; den är inte byggd.

**Confirm sign up**, ämne `Bekräfta din e-postadress hos Nextrum`:

```html
<h2>Bekräfta din e-postadress</h2>
<p>Klicka på länken för att bekräfta din e-postadress, så är kontot klart.</p>
<p><a href="https://nextrum.se/lank#{{ .ConfirmationURL }}">Bekräfta e-postadressen</a></p>
<p>Har du inte skapat något konto hos Nextrum kan du strunta i mejlet.</p>
<p>Nextrum</p>
```

**Invite user**, ämne `Du har fått ett konto hos Nextrum`:

```html
<h2>Välkommen till Nextrum</h2>
<p>Du har fått ett konto hos Nextrum. Klicka på länken och välj ett lösenord.</p>
<p><a href="https://nextrum.se/lank#{{ .ConfirmationURL }}">Välj lösenord</a></p>
<p>Sedan loggar du in med den här e-postadressen och lösenordet du valde.</p>
<p>Väntade du dig inte det här mejlet kan du strunta i det.</p>
<p>Nextrum</p>
```

**Reset password**, ämne `Återställ ditt lösenord hos Nextrum`:

```html
<h2>Välj ett nytt lösenord</h2>
<p>Klicka på länken och välj ett nytt lösenord.</p>
<p><a href="https://nextrum.se/lank#{{ .ConfirmationURL }}">Välj nytt lösenord</a></p>
<p>Har du inte bett om det här kan du strunta i mejlet. Ditt lösenord är detsamma som förut.</p>
<p>Nextrum</p>
```

**Magic link**, ämne `Logga in hos Nextrum`:

```html
<h2>Logga in</h2>
<p>Klicka på länken för att logga in hos Nextrum.</p>
<p><a href="https://nextrum.se/lank#{{ .ConfirmationURL }}">Logga in</a></p>
<p>Har du inte bett om att logga in kan du strunta i mejlet.</p>
<p>Nextrum</p>
```

**Change email address**, ämne `Bekräfta din nya e-postadress hos Nextrum`:

```html
<h2>Bekräfta din nya e-postadress</h2>
<p>Klicka på länken för att byta e-postadress från {{ .Email }} till {{ .NewEmail }}.</p>
<p><a href="https://nextrum.se/lank#{{ .ConfirmationURL }}">Byt e-postadress</a></p>
<p>Har du inte bett om att byta e-postadress kan du strunta i mejlet.</p>
<p>Nextrum</p>
```

**Reauthentication**, ämne `Din kod hos Nextrum`:

```html
<h2>Bekräfta att det är du</h2>
<p>Din kod: <b>{{ .Token }}</b></p>
<p>Har du inte bett om en kod kan du strunta i mejlet.</p>
<p>Nextrum</p>
```

### Samtycket (2026-09-27)

De öppna sidorna sätter inga cookies. Det som kräver samtycke
(LEK 9 kap. 28 §) går genom `NXSamtycke` i `nextrum-samtycke.js`, och
vad som är påslaget står i `NEXTRUM_CONFIG.SAMTYCKE`. **Rutan visas
bara när något där är på.** Är allt av finns ingen ruta, ingen länk i
footern och ingenting lagras: en ruta som ber om lov till ingenting är
brus.

**Rutan är avstängd tills vidare sedan 2026-09-29** (Leo: "inaktivera
cookie banner tills vidare"). `STATISTIK` och `KALLSPARNING` står på
`false`, och det är hela avstängningen: rutan är inget eget reglage.
Följden är att Vercels statistik inte laddas alls och att en anmälan
inte kan krediteras en annons (källan blir `null`, alltså okänd i
`analys_leads_per_kalla`). Dölj inte bara rutan med CSS och låt
skripten gå: det är mätning utan samtycke. Slå på igen genom att sätta
båda till `true` och köra `verktyg/satt-version.py`. `lagring.html`
säger "det finns inget att samtycka till" så länge de står av, vilket
är sant.

- **Två syften, två val: statistik och annonser.** Rutan har Neka
  alla, Godkänn alla och en kryssruta per syfte (ingen förkryssad) med
  Spara mitt val. Svaret är `{v:2, val:{statistik, annonser}}`; ett
  svar i det gamla formatet räknas som inget svar. `SYFTE` i
  `nextrum-samtycke.js` säger vilket syfte varje reglage hör till.
- **Vercels besöksstatistik laddas först efter ja** (2026-09-27).
  Taggarna till `/_vercel/insights` och `/_vercel/speed-insights` stod
  förut statiskt på alla 35 sidor och körde innan någon frågats. Den
  räknar utan cookies, men skriptet får webbläsaren att skicka data,
  och det är "åtkomst" enligt EDPB:s riktlinjer 2/2023; PTS räknar
  statistik som inte nödvändig. Nu lägger `laddaVercel()` in dem vid
  ja. **Lägg aldrig tillbaka en statisk tagg.** Dras ett ja tillbaka
  laddas sidan om, för ett skript som redan kört går inte att stänga av.
- **Källspårningen hör till annonser.** Med ett ja minns
  webbläsaren landningen tills fliken stängs (sessionStorage
  `nx-kalla`, skrivs av `NX.källa()`), så att en anmälan krediteras
  annonsen och inte sidan den skickades från. **Utan ja är en okänd
  källa `null`, inte "direkt"**: har besökaren kommit från en annan sida
  hos oss vet vi inte var hen landade, och `analys_leads_per_kalla`
  räknar null som okänd (avsnitt 5, regel 3). Förut blev varje familj
  som läst två sidor före anmälan "direkt".
- **Pixlarna (Meta, Google) är byggda och tomma.** Ett id i
  konfigurationen slår på dem, och de laddas först efter ja. Innan ett
  id skrivs in: `lagring.html` och integritetspolicyn på båda språken
  (mottagare, överföring till USA), domänerna i CSP:n i `vercel.json`,
  och för Meta automatisk avancerad matchning AV i Events Manager. IMY
  bötfällde svenska företag för Meta-pixeln 2024. Bara
  `intresseanmalan` är en konvertering; en jobbansökan är inte en kund.
- **Ett ja gäller det rutan beskrev** (`omfattar`). Slås ett nytt syfte
  på frågar rutan alla igen. Svaret (`localStorage` `nx-samtycke`)
  gäller ett år. Global Privacy Control räknas som nej.
- **Ja och nej är samma knapp.** Samma storlek, samma stil, bredvid
  varandra. Gör aldrig nej till en grå länk.
- **Klasserna heter `nx-kakor-*`.** `.nx-samtycke` är GDPR-kryssrutan
  under formulären; första versionen av rutan hette så och flyttade
  kryssrutan ut i hörnet med `position:fixed`.
- Rutan laddas bara på de öppna sidorna. De inloggade vyerna har inget
  som kräver samtycke: inloggningen, de hopfällda menyerna och Stripes
  två cookies (`__stripe_mid`, `__stripe_sid`, satta först när familjen
  trycker Betala med kort) är nödvändiga för något besökaren själv bett
  om.

`lagring.html` (och `/en/`) säger exakt vad som lagras, och panelen
där (`#ditt-val`) är samma val som rutan. **Ändras lagringen ska
sidorna följa med i samma ändring.** Fas 14.5 lade till Stripe utan
att sidan följde med, och i tre veckor stod det "vi sätter inga
cookies alls".

### Supabases säkerhetsadvisor larmar om saker som är med flit

`get_advisors(type: 'security')` ger ett fyrtiotal varningar. De flesta
är väntade, och listan nedan finns för att ingen ska utreda dem en
gång till. **Kontrollerat 2026-09-23, med prov mot driften, igen
2026-09-27, och 2026-09-30 efter barnkontona:**

| Varning | Varför den är väntad |
|---|---|
| `rls_enabled_no_policy` på `notis_konfig`, `kund_skatteuppgifter`, `stripe_handelser`, (sedan Fas 18.1) `google_koppling`, och (sedan 2026-09-30) `barn_andringsfonster` och `barn_notiser` | RLS på utan en enda policy ÄR skyddet: bara `service_role` ser dem. Se avsnitt 6 ovan. Barnets notiser läses bara genom `barn_notiser()`, och fönstren skrivs bara av `barn-konto` |
| 49 SECURITY DEFINER-funktioner i `public` nåbara för `authenticated`, triggerfunktionerna oräknade (räknat i driften 2026-09-30 efter `barnkonto_skapas_genom_auth`; 42 före barnkontona, med de sju i raden om barnkontona nedan; 40 dagen före). Förut stod 35 här, räknat före Fas 23.1 och på ett sätt som inte skrevs ned. Bland de senaste: `mina_tips`, `tipskoder_lage`, `chatt_las`, `nexlax_lage`, `driftkorningar`, `mina_handlingar`, `radering_lage` och `radera_person` | Adminfunktionerna kontrollerar `is_admin()` internt. Resten svarar bara om den inloggade själv: `faktura_mojlig`, `far_forbereda_passet`, `upptagna_tider` (egen eller matchad studiehjälpare), `mina_handlingar` (handlingar delade med den inloggade), `mina_tips` (den inloggades egen kod och antal, aldrig vilka), `ar_*`- och `is_my_*`-hjälparna. Att EXECUTE finns är inte samma sak som att funktionen gör något |
| `is_admin(uid)` nåbar för `anon` | Funktionen hämtar raden bara om `uid` är ens eget ELLER anroparen själv är admin. Som anon är `auth.uid()` null, så villkoret faller alltid |
| Barnkontonas och adminrollernas funktioner (2026-09-30): `har_behorighet`, `har_nagon_behorighet`, `mina_behorigheter`, `admin_kan_ge`, `gor_till_admin`, `ta_bort_admin`, `mina_barnkonton` | Alla svarar om den inloggade själv eller prövar anroparen i triggern `admin_roller_vakt`. `har_behorighet` och `har_nagon_behorighet` är nåbara för `anon` för att de står i policyer `to public` (Fas 10-fällan); med `auth.uid()` null svarar de nej. Barnets tre funktioner når bara rollen `nextrum_barn` |
| `kolla_rabattkod` nåbar för `anon` | Första raden i kroppen är `if auth.uid() is null then return 'Logga in först.'` |
| `ar_matchade`, `ar_min_elev`, `is_my_student`, `is_my_matched_tutor`, `is_matched_tutor_of` nåbara för `anon` | Alla jämför mot `auth.uid()`, som är null för anon, så svaret är alltid falskt. De backar policyer, och en revoke från anon är Fas 10-fällan om någon av dem står i en policy `to public` |
| `publika_studiehjalpare` nåbar för `anon` | Den ÄR den publika listan: förnamn, ålder, stad, ämnen, bio, bara godkända med `visa_publikt` |
| `extension_in_public` för `btree_gist` och `pg_net` | `btree_gist` bär överlappsvillkoret på `bookings` (v9), och `pg_net` går inte att flytta med `set schema`. Att flytta dem vinner ingenting och riskerar det som hänger på dem |

**`function_search_path_mutable` ska vara tom.** Den larmade 2026-09-30 på tolv NexLäx-funktioner
i `intern` (Fas 23.1 och 23.2), och `20261001000100_nexlax_fast_search_path` gav dem
`public, pg_temp` med `alter function … set`. En funktion som skrivs om med `create or replace`
tappar sin SET om den inte står med i den nya texten, så nästa larm där är ett äkta.

**Triggerfunktioner har ingen EXECUTE** (v14b, v16c, Fas 19.4). Supabases
förval ger varje ny funktion EXECUTE för anon och authenticated, och
Fas 16.1 fick tillbaka tre. En trigger prövar rättigheten när den
skapas, inte när den körs, så en revoke ändrar ingenting i vad den
gör. `rls-test.sql` har en rad som fångar nästa.

Proven, körda som `anon` i en transaktion som rullades tillbaka:
`is_admin(<en riktig admin>)` → `false`, `is_admin(<vanlig användare>)`
→ `false`, `is_admin()` → `false`, `kolla_rabattkod(…)` → `"Logga in
först."`

**Ett larm som VAR äkta, och är rättat:** `ar_godkand_studiehjalpare(uid)`
var nåbar för `anon` och svarade om vilket uuid som helst — prövat mot
driften gav den `true` för en godkänd hjälpare där `is_admin` samma väg
gav `false`. Den saknade alltså precis den vakt som gör `is_admin`
ofarlig. Fas 14.0b gav den samma vakt och återkallade EXECUTE från
anon. Att revoke var säkert PRÖVADES FÖRST: alla fem policyer som
backar funktionen är `to authenticated`, och inget check-villkor, ingen
vy och ingen annan funktion nämner den. Hade någon varit `to anon` hade
Fas 10-fällan slagit till igen. **Lärdomen: en ny funktion som svarar
på en fråga om en PERSON ska ha is_admins vakt från första raden.**

**Två saker som inte är falsklarm:**

1. **Läckta lösenord kontrolleras inte.** Supabase Auth kan stämma av
   mot HaveIBeenPwned. Det är en kryssruta under Authentication →
   Policies, kostar ingenting och gäller nya och ändrade lösenord.
2. **`kolla_rabattkod` har inget tak per inloggad användare.** I dag
   spelar det ingen roll: `rabattkoder` är TOM, så det finns ingenting
   att gissa. **Skapas den första koden återkommer frågan** — en
   inloggad kan då pröva koder i en slinga. Lägg ett tak då, inte nu.

### Content-Security-Policy

`/admin`, `/larare` och `/foralder` får en **skarp** CSP från
`vercel.json`: `script-src 'self'`. Alltså:

**Ingen inline-JavaScript i de tre sidorna. Inga `<script>` utan `src`,
inga `onclick="…"`, inga `javascript:`-adresser.**

`verktyg/kolla-csp.py` kontrollerar det i CI. De publika sidorna har
kvar policyn i Report-Only eftersom de fortfarande har inline-skript.
`/barn` fick samma rad som `/admin` och `/larare` med barnkontona, och
`/lank` (2026-10-01): sidan bär Auths engångslänk i adressen, och ett
skript som inte är vårt hade kunnat läsa den.

**`/foralder` släpper in Stripe, och bara Stripe** (Fas 14.5). Kassan
ritas i en panel på sidan i stället för på Stripes egen, och Stripe.js
får inte vendoras: det ska alltid hämtas från `js.stripe.com`. Sidan
har därför en egen rad i `vercel.json`, med Stripes domäner i
`script-src`, `frame-src`, `connect-src` och `img-src`, och
`payment` tillåtet för Stripes ramar i Permissions-Policy (Apple Pay
och Google Pay). `/admin` och `/larare` har kvar exakt den gamla
policyn. Regeln om inline-JavaScript gäller oförändrat också på
`/foralder`: Stripe.js laddas med en `src`, när familjen trycker
Betala. **Lägg aldrig två skarpa CSP-rader som båda matchar samma
sida**: webbläsaren kräver då båda, och Stripe stoppas av den strängare.
