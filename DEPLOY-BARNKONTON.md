# Sätta barnkontona och adminbehörigheterna i drift

Grenen `barnkonton_och_admin` (2026-09-30) byggde två saker:

- **Barnens egen inloggning.** Föräldern skapar den i studievyn (Profil &
  inställningar → Barn → Barnens inloggning), och barnet loggar in på
  `nextrum.se/barn` med ett användarnamn. Barnet ser sina pass, timmar,
  studieplan och notiser, och rapporterna om föräldern slår på det.
- **Admins med behörigheter.** Superadmin har allt, som admin hade förut.
  Andra admins får de behörigheter de behöver, under System →
  Adminhantering, antingen som ny person (inbjudan) eller som befintlig
  användare.

Varför det ser ut som det gör står i `minne/barnkonton-och-admin.md`.

**Läget 2026-09-30:** steg 1, 2, 3 och 6 (utom 6.5) är gjorda. Båda
migrationerna är körda, `barn-konto` och `admin-skapa` är driftsatta, och
kedjan är provad mot riktiga Auth med en testfamilj som sedan togs bort
(`minne/barnkonton-och-admin.md`, Driften). **Kvar för hand:** steg 4
(Auth-inställningarna, i Supabase-panelen), steg 5 (null-MX:en, i
Cloudflare), 6.5 (en skarp inbjudan) och 7 (säga till familjerna).

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

- **Authentication → URL Configuration → Redirect URLs:** lägg till
  `https://nextrum.se/admin`. Inbjudan leder dit, och utan raden leder den
  till Site URL i stället, där ingen ber om ett lösenord.
- **Authentication → Providers → Email:** slå på *Secure email change*.
- **Authentication → Settings:** *Allow manual linking* ska vara av.
- **Authentication → Email Templates → Invite user:** skriv mallen på
  svenska. Förvalet är engelska ("You have been invited").
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

## Stänga av barnkontona snabbt

Pausa alla barn på en gång, i SQL Editor (triggern släpper igenom SQL):

```sql
update public.students set barn_aktiv = false where user_id is not null;
```

Barnens funktioner svarar då "pausad" direkt. Inloggningarna ligger kvar i
Auth; föräldrarna aktiverar dem igen i studievyn.
