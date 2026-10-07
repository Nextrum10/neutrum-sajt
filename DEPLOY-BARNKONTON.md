# Sätta barnkontona och adminbehörigheterna i drift

Grenen `barnkonton_och_admin` (2026-09-30) byggde två saker:

- **Barnens egen inloggning.** Föräldern skapar den i studievyn (Profil &
  inställningar → Barn → Barnens inloggning), och barnet loggar in på
  `nextrum.se/barn` med ett användarnamn, eller med samma användarnamn
  under Logga in på sajten, som skickar barnet dit (2026-10-01). Barnet ser sina pass, timmar,
  studieplan och notiser, och rapporterna om föräldern slår på det. Sedan 2026-10-06
  väljer föräldern allt det (avsnitt 9).
- **Admins med behörigheter.** Superadmin har allt, som admin hade förut.
  Andra admins får de behörigheter de behöver, under System →
  Adminhantering, antingen som ny person (inbjudan) eller som befintlig
  användare.

Varför det ser ut som det gör står i `minne/barnkonton-och-admin.md`.

**Läget 2026-09-30:** steg 1, 2, 3 och 6 (utom 6.5) är gjorda. Båda
migrationerna är körda, `barn-konto` och `admin-skapa` är driftsatta, och
kedjan är provad mot riktiga Auth med en testfamilj som sedan togs bort
(`minne/barnkonton-och-admin.md`, Driften). **Kvar för hand:** steg 4
(Auth-inställningarna i Supabase-panelen; Redirect URL är redan rätt),
steg 5 (null-MX:en, i Cloudflare), 6.5 (en skarp inbjudan) och 7 (säga
till familjerna).

---

## 1. Merga först

`CLAUDE.md` avsnitt 7: driftsätt aldrig från en gren som inte är mergad.
Vyerna tål att migrationen saknas (rutan Barnens inloggning syns inte, och
adminvyn fungerar som förut), så det går att merga före steg 2.

## 2. Kör migrationen

Filen är `supabase/migrations/20261001000000_barnkonton_och_admin.sql`.
Kör den med `apply_migration` och namnet `barnkonton_och_admin`, och döp
sedan om filen till den version databasen registrerade
(`select version, name from supabase_migrations.schema_migrations order by version desc limit 3;`).
`kolla-migrationer.py` blir rött tills namnet stämmer.

Migrationen stannar av sig själv, och ändrar ingenting, om en funktion den
skriver om inte ser ut som i main: `is_admin()` har en md5-vakt, och de sex
lappade funktionerna räknar sina träffar. Stannar den: läs funktionen i
driften (`select pg_get_functiondef('public.is_admin(uuid)'::regprocedure);`)
och skriv om migrationen, gissa inte.

**Sedan rättelsen**, `supabase/migrations/20261001000200_barnkonto_skapas_genom_auth.sql`
med namnet `barnkonto_skapas_genom_auth`. Utan den går inget barnkonto att
skapa: GoTrue skriver raden i `auth.users` innan `app_metadata` finns på
den, och den första spärren nekade det (`minne/barnkonton-och-admin.md`).
Den har md5-vakter på de två triggerfunktionerna den skriver om.

Efteråt, i SQL Editor:

```sql
-- Rollen finns och PostgREST kan byta till den.
select rolname from pg_roles where rolname = 'nextrum_barn';
select pg_has_role('authenticator', 'nextrum_barn', 'member');   -- true

-- Dagens admins blev superadmins, och is_admin följer med.
select r.user_id, r.ar_superadmin, p.email, p.is_admin
  from public.admin_roller r join public.profiles p on p.id = r.user_id;

-- Jobbet för barnens notiser.
select jobname, schedule from cron.job where jobname = 'barnkonton-gallring';
```

**Går `grant nextrum_barn to authenticator` inte igenom på den hostade
Supabase** stannar migrationen där, och inget är ändrat. Det är det enda
steget som kräver något av plattformen vi inte provat. Säg till innan
någon skriver om det: utan rollen finns inget barnkonto som är stängt som
förval.

## 3. Driftsätt de två funktionerna

```sh
supabase functions deploy barn-konto
supabase functions deploy admin-skapa
```

Båda kräver inloggning, så ingen rad i `supabase/config.toml` behövs.

## 4. Auth-inställningarna i Supabase

- **Authentication → URL Configuration → Redirect URLs:**
  `https://nextrum.se/admin` ska vara tillåten. Inbjudan leder dit, och
  utan raden leder den till Site URL i stället, där ingen ber om ett
  lösenord. **Den är redan tillåten** (provat 2026-09-30: en `verify` med
  en ogiltig token skickade tillbaka till `/admin`, `/foralder`, `/larare`
  och `/barn`, men till Site URL för en främmande adress), så här finns
  inget att göra. Glömt lösenordet leder till samma vägar.
- **Authentication → Emails → SMTP Settings:** egen SMTP är på (Googles
  SMTP som info@nextrum.se; provat 2026-10-01 med en adress utanför
  organisationen, mejlet låg i inkorgen efter en sekund). Supabases
  inbyggda mejl hade bara nått medlemmarna i organisationen
  (`minne/sakerhet.md`).
- **Authentication → Email Templates → Reset password** och **Confirm
  sign up:** de svenska mallarna står i `minne/sakerhet.md`, under
  Kontomejlen. Länken i dem går genom `/lank`, så sidan ska vara
  driftsatt innan mallarna klistras in.
- **Authentication → Providers → Email:** slå på *Secure email change*.
- **Authentication → Settings:** *Allow manual linking* ska vara av.
- **Authentication → Email Templates → Invite user:** skriv mallen på
  svenska. Förvalet är engelska ("You have been invited"). Texten står i
  `minne/sakerhet.md`, under Kontomejlen, med de andra mallarna.
- Slå inte på kryptering av lösenordshasharna utan att läsa
  `minne/barnkonton-och-admin.md` först: en omskriven hash vid inloggning
  stoppas av spärren på barnkontona.

## 5. DNS: barn.nextrum.se tar inte emot post

Adressen `<användarnamn>@barn.nextrum.se` finns bara för att Auth kräver
en. Ingen post ska kunna levereras dit, och en null-MX säger det till
varje avsändare:

```
barn.nextrum.se.  MX  0 .
```

Ingen A- eller AAAA-post för namnet. Zonen ligger hos **Cloudflare**
(`DEPLOY-EPOST.md`), inte hos Vercel: DNS → Records → Add record, typ MX,
namn `barn`, mail server `.`, prioritet 0. Tar Cloudflare inte `.` som
mail server: låt bli hellre än att peka på en påhittad server. Auth
skickar ändå inget dit (nästa stycke).

Sedan rättelsen (mejlspärren i `*_sent_at`) skickar Auth inget till en
barnadress, provat i driften. Null-MX:en är andra lagret: skulle en
uppgradering av Auth ändra ordningen studsar posten direkt.

## 6. Prova i driften

Med en testfamilj, i ett privat fönster per person:

1. Skapa en inloggning åt ett barn i studievyn. Logga in på `/barn`, logga
   ut, **logga in igen** (se steg 4 om hasharna).
2. I webbläsarens konsol på `/barn`, inloggad som barnet:
   `await supa.from('students').select('*')` ska ge `permission denied`,
   och `await supa.rpc('barn_oversikt')` ska svara.
3. `await supa.auth.resetPasswordForEmail('<användarnamn>@barn.nextrum.se')`
   ska svara 429 (mejlspärren i `recovery_sent_at`) och inget mejl ska gå,
   varken i Auths logg eller hos Resend. Kontrollera i SQL att
   `recovery_token` för kontot fortfarande är tom.
4. Pausa inloggningen i studievyn: barnet ska loggas ut inom en minut och
   se "Din inloggning är pausad". Aktivera, byt lösenord, ta bort.
5. Bjud in en ny admin med bara Intresseanmälningar. Öppna länken i mejlet,
   välj lösenord, och se att bara Intresseanmälningar och System →
   Adminhantering (om du gav den) syns.
6. Kör `verktyg/rls-test.sql` mot driften i en transaktion som rullas
   tillbaka (`CLAUDE.md` avsnitt 9). Varje rad ska vara `ok`.

## 7. Säg till

Integritetspolicyn har ändrats (barnens inloggning). Mejla familjerna med
konto, i samma mejl som resten av det som står under "Att säga till" i
`CLAUDE.md` avsnitt 11, och låt juristen läsa grunden (`DATASKYDD.md`
avsnitt 8).

---

## 8. Barnets egen e-post (barnets_epost, 2026-10-01)

Föräldern lägger till barnets egen adress under barnets inloggning,
barnet bekräftar den med knappen i ett mejl, och sedan kan barnet logga in
med den och, om föräldern slår på det, få mejl om bokade och avbokade pass
och en påminnelse före passet. Barnet väljer bort sorter under
Inställningar i sin vy. Varför det ser ut som det gör:
`minne/barnkonton-och-admin.md`, Barnets egen e-post.

**Allt står bakom flaggan `barn_epost`, som står av.** Med den av syns
inget av det, inloggningen med en barnadress nekas och inga mejl går till
barn. Gör så här, i ordning:

1. **Gjort 2026-10-01: mergat och kört.** PR #175 (ffa5b6b), och sedan
   `nexlax_for_barnet` och `barnets_epost` i driften, registrerade med
   filernas egna versioner (20261001140000 och 20261001160000) och samma
   md5 som filerna, så ingen fil behövde döpas om.
2. **Gjort 2026-10-01: driftsatt från main.** `barn-inloggning` v1
   (`verify_jwt = false` står i `config.toml`), `notis-ko` v21 och
   `notis-avanmal` v9, hämtade tillbaka och lika med main fil för fil, och
   provade mot driften med flaggan av (`minne/funktioner.md`).
3. **Gjort 2026-10-01: `verktyg/rls-test.sql` mot driften**, i en
   transaktion som rullades tillbaka, både före och efter migrationerna:
   1220 rader gröna. Avsnitt 15 slår på flaggan inne i transaktionen; i
   driften står den av.
4. **Juristen läser** registrets rad 22, de tre raderna från 2026-10-01 i
   konsekvensbedömningen (`DATASKYDD.md` avsnitt 5) och avsnitten om barn
   i integritetspolicyn, på båda språken. Frågorna att ställa: räcker 6.1 b
   genom föräldern för barnets adress och mejlen, är 6.1 f rätt för
   räknaren, och hur gör vi med ett barn under 13 som har en egen adress.
5. **Prova i sandlådan.** Sätt `notis_drift.mejl_sandlada`, slå på
   flaggan, lägg till en adress åt ett testbarn och se bekräftelsen komma
   till sandlådan. Tryck på knappen (den bekräftar på riktigt), logga in
   med adressen på `/barn`, slå på mejlen, boka ett pass och se mejlet.
   Prova Avsluta i mejlet och Ta bort i studievyn. Ta bort sandlådan
   efteråt.
6. **Säg till familjerna** i samma mejl som policyändringen (steg 7).

Stänga av: sätt flaggan till av. Adresserna ligger kvar och går att ta
bort; inloggningen med dem och mejlen stannar direkt.

---

## 9. Intaget, introduktionen och barnets behörigheter (2026-10-06)

Admin skapar familjens konto (Ta in familjen på en anmälan) och
studiehjälparens (Ta in i poolen på en ansökan) med personens adress.
Personen får ett mejl med en länk, väljer lösenordet två gånger, går
igenom introduktionen och trycker Fortsätt. Föräldern väljer vad barnet får
se och göra med sin inloggning. Varför det ser ut som det gör:
`minne/sakerhet.md` (Konton vi skapar), `minne/funktioner.md` (`bjud-in`),
`minne/vyerna.md` (Introduktionen) och `minne/barnkonton-och-admin.md`
(Barnets behörigheter). I ordning:

1. **Gjort 2026-10-07: mergat.** PR #204 (43d2ef4), med main:s #203,
   #205 och #206 intagna, klockan 00.58. Vyerna gick ut med Vercel och
   klarade natten utan migrationen, som kördes 08.30.
2. **Gjort 2026-10-07: migrationen körd** efter `barnets_chatt`. Driftens
   arton funktioner var md5-lika med 2026-10-06 innan, så inga lappar
   stannade. Filen hämtades från merge-commiten, prövades mot sin md5
   (`a39edcf6…`) och kördes och registrerades som version
   `20261006233000`, namn `barnets_behorigheter`, i ett `do`-block: allt
   eller inget (`minne/databasen.md`, Att köra en migration i driften,
   punkt 3; det går bara för en fil utan `drop` och `delete`).
3. **Gjort 2026-10-07: driftsatt från main.** `bjud-in` v9 och
   `ansokan-notis` v8, hämtade tillbaka och lika med main fil för fil (5
   och 13 filer). Röktest genom `intern.natanrop`: `bjud-in` med den
   publika anon-nyckeln svarar 401 från funktionen, och utan token 401
   från grinden; `ansokan-notis` med hemligheten och ett okänt id svarar
   200 utan att skicka något, och utan hemligheten 401.
4. **Gjort 2026-10-07: `verktyg/rls-test.sql` mot driften**, hela filen
   från merge-commiten i en transaktion som rullades tillbaka: 1393 av
   1394 före migrationen (avsnitt 22 stannade på att kolumnen saknades)
   och 1433 av 1433 efter.
5. **Auth-inställningarna**: inget ändrat. Lämna Email OTP Expiration
   på förvalet, en timme, med flit: en längre tid gäller alla mejllänkar
   och deras koder, och en utgången inbjudan leder rakt till en ny länk
   (`minne/sakerhet.md`, Konton vi skapar). Redirect URLs har redan
   `/foralder` och `/larare`, och mallen Invite user ber redan om ett
   lösenord.
6. **Kvar: prova skarpt** med en egen plusadress: Ta in en provfamilj ur en
   provanmälan, tryck på länken, välj lösenordet, gå igenom
   introduktionen, logga ut och in med lösenordet. Prova Skicka inbjudan
   igen på ett konto som inte tryckt på länken. Ta bort provfamiljen i
   adminvyns panel (`radera_person()`), aldrig i dashboarden.
7. **Kvar: säg till familjerna** att de kan välja vad barnet ser (det står
   i integritetspolicyn), i samma mejl som avsnitt 7.

## 10. Användarvillkoren och provobjekten (2026-10-07)

Leo: "Fixa den gamla luckan och skräp i databasen". Ingen godkände
användarvillkoren när kontot skapades. Nu kryssar den som registrerar sig
i en ruta, och alla andra godkänner villkoren i en ruta vid inloggningen
(efter lösenordet, före introduktionen). Databasen sparar godkännandet med
sin egen tid och kräver det för att ett pass ska föreslås eller bekräftas
och för att timmar ska köpas. Varför det ser ut som det gör:
`minne/sakerhet.md` (Användarvillkoren) och `minne/databasen.md`. I ordning:

1. **Merga.** Vyerna går ut med Vercel och tål att migrationen saknas:
   utan `mitt_villkorslage()` visas ingen ruta, och adminpanelen säger
   "okänt" om villkoren.
2. **Kör `20261007120000_villkoren_godkanns.sql`.** Ingen `drop` och ingen
   `delete`, så den kan hämtas från merge-commiten, prövas mot sin md5 och
   köras och registreras i ett `do`-block (`minne/databasen.md`, punkt 3).
   Från och med nu kräver databasen godkännandet: de konton som finns får
   frågan vid nästa inloggning och kan inte boka innan dess.
3. **`verktyg/rls-test.sql` mot driften**, hela filen i en transaktion som
   rullas tillbaka: varje rad ok (1459 lokalt 2026-10-07).
4. **Kör `20261007120100_provobjekten_tas_bort.sql`.** Den har `drop`, så
   verktyget ber om en bekräftelse; säg ja. Registrera filens text och
   pröva md5 som för de andra. Säkerhetskontrollen ska efteråt sakna de
   nio varningarna om `zz_prov_*`.
5. **Prova skarpt**: logga in som dig själv i studievyn (rutan kommer,
   godkänn) och se raden under Användarvillkoren i adminvyns panel.
6. **Kvar: juristen läser** rad 24 i `DATASKYDD.md` och meningen i
   integritetspolicyn.

---

## Stänga av barnkontona snabbt

Pausa alla barn på en gång, i SQL Editor (triggern släpper igenom SQL):

```sql
update public.students set barn_aktiv = false where user_id is not null;
```

Barnens funktioner svarar då "pausad" direkt. Inloggningarna ligger kvar i
Auth; föräldrarna aktiverar dem igen i studievyn.
