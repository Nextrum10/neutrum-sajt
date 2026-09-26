# Nextrum — så får du igång det

Fyra inloggade sidor nu. Alla filer måste ligga i **samma mapp**, annars
hittar de inte varandra.

| Fil | Vad det är |
|---|---|
| `index.html` | Huvudsidan. Publik. Exempel på studiehjälpare + intresseanmälan. |
| `foralder.html` | Studievyn. Elev och förälder. Låst tills ni matchat familjen. |
| `larare.html` | Studiehjälparvyn. Låst tills ni godkänt personen. |
| `admin.html` | **Adminvyn.** Ledningens arbetsyta. Kräver `is_admin` på din profilrad. |
| `nextrum-config.js` | **Den enda filen du behöver ändra i.** Nycklarna hit. |
| `nextrum.css` | Utseendet. Delas av alla sidor. |
| `nextrum-app.js` | Delad kod (inloggning, kalender, felmeddelanden). |
| `nextrum-arbetsyta.js` / `.css` | Hälsningsblocket, flikarna, bokningen, veckorutnätet. |
| `nextrum-admin.js` | Bara adminvyn. |
| `supabase/migrations/` | Databasen. Se steg 1. |

---

## Steg 1 — databasen

**Sedan Fas 3 (september 2026) ligger all SQL i `supabase/migrations/`.**
Varje fil heter `<version>_<namn>.sql`, där versionen är exakt den som
står i Supabases migrationstabell (`supabase_migrations.schema_migrations`).
Filen och databasen säger alltså samma sak om vad som är kört — fråga
databasen, inte filnamnet:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

De gamla numrerade filerna, `schema.sql` till `schema-v25.sql`, ligger kvar
i `supabase/migrations/arkiv/`. `arkiv/README.md` säger vilken version i
databasen varje fil motsvarar, och vilka som aldrig kördes.

**Ny miljö från noll:** kör arkivets filer i den ordning README:n anger,
sedan filerna i `supabase/migrations/` i namnordning. Kör aldrig
`arkiv/schema-v22.sql` — den ersattes av `arkiv/schema-v25.sql`. Och kör om
`arkiv/schema.sql` bara om du vill börja om från noll: den rensar
tabellerna först.

**Befintlig miljö:** ny SQL skrivs som en ny fil i `supabase/migrations/`
och körs med Supabases migrationsverktyg, så att den hamnar i tabellen.
Klistra inte in SQL i SQL Editor utan att den också blir en fil här —
det var så tre nummer kom att tas två gånger.

Några äldre som vyerna märker om de saknas: utan `schema-v13` går
statusarna inte att ändra i adminvyn, utan `schema-v14` säger Matchning
att vyn fattas, och utan `schema-v17` uteblir notismejlen (se
`DEPLOY-EPOST.md`). Vyerna säger vilken fil som fattas i stället för att
visa nollor.

## Steg 2 — klistra in nycklarna

Supabase → **Project Settings → API**. Du behöver två saker:

- **Project URL** (ser ut som `https://abcdefgh.supabase.co`)
- Nyckeln under "Project API keys" som heter **`anon`** / `public`

Öppna `nextrum-config.js` i en texteditor, byt ut de två platshållarna, spara.

> Nyckeln som heter `service_role` ska **aldrig** in i någon av dessa filer. Den ger full åtkomst till allt och ligger i webbläsaren där vem som helst kan läsa den.

## Steg 3 — testa

Öppna `index.html` i webbläsaren. Kolla att sektionen "Några av dem som hjälper till" säger *"Inga studiehjälpare är publicerade än"* och inte *"Databasen är inte kopplad"*. Säger den det senare är steg 2 inte klart.

**Viktigt:** en Claude-artefaktlänk (`claude.ai/...`) kan aldrig prata med Supabase, den blockerar externa anrop av säkerhetsskäl. Testa alltid mot den riktiga filen, eller lägg upp mappen på Netlify Drop (gratis, dra in mappen, klart).

### Den automatiska kontrollen

`.github/workflows/kontroll.yml` körs på varje push och pull request. Den kör samma verktyg som finns i `verktyg/`: syntaxen i all JavaScript, `testa-agent.js`, betalningslöftet, migrationsnamnen, att maskotsvaren och FAQ-schemat är ombyggda, att engelskan följt med (mot `verktyg/jamfor-sprak-baslinje.txt`), samt `deno check` och `deno test` för edge-funktionerna. Den ska vara grön innan en gren mergas.

### Content-Security-Policy

`/admin`, `/larare` och `/foralder` får en skarp CSP från `vercel.json`: bara skript från den egna domänen, anrop bara till den egna domänen och Supabase. Ingen JavaScript får stå direkt i de tre sidorna — inga `<script>` utan `src`, inga `onclick="…"`. `verktyg/kolla-csp.py` kontrollerar det. De publika sidorna har kvar policyn i läget Report-Only, eftersom de fortfarande har inline-skript.

---

## Så här matchar ni en familj

Det här är själva affärsmodellen, så det är värt att kunna utantill.

1. Familjen skickar **intresseanmälan** på huvudsidan → hamnar i tabellen `leads`
2. Ni ringer eller mejlar och väljer ut en studiehjälpare
3. Familjen skapar konto på `foralder.html`
4. `admin.html` → **Familjer** → välj studiehjälpare i rullgardinen på
   familjens rad. Det sätter `matched_tutor_id` och `match_status`
   samtidigt — förr var det två kolumner i Table Editor, och satte man
   bara den ena såg familjen en låst vy utan att förstå varför.
5. Föräldern lägger in sitt barn i sin vy (eller ni gör det i `students`)
6. Studiehjälparen skriver studieplanen i sin vy

Först efter steg 4 låses föräldravyn upp. Innan dess ser familjen ett väntläge, inte en trasig sida.

## Så här godkänner ni en studiehjälpare

`admin.html` → **Studiehjälpare** → sätt läget till *Godkänd*. Först då
syns personen på huvudsidan och kommer in i sin egen vy.

## Så här gör du dig själv till admin

Registrera ett konto på sidan först. Sedan Supabase → **SQL Editor**:

```sql
update public.profiles set is_admin = true where email = 'din@adress.se';
```

Då kommer du in på `admin.html`.

Det går **inte** att sätta flaggan från någon av vyerna, inte ens som
admin. Triggern i `supabase/migrations/arkiv/schema-v3.sql` vägrar ändra `is_admin` från en inloggad
session, och det är med flit: den som kan göra sig själv till admin i sin
egen vy är inte begränsad av något.

---

## Två säkerhetshål som fixades i `supabase/migrations/arkiv/schema-v3.sql`

Värt att förstå, för det förklarar varför filen finns.

De gamla reglerna sa "du får uppdatera din egen rad", men sa ingenting om **vilka fält**. Alltså kunde vem som helst med ett konto:

- sätta `is_admin = true` på sig själv och läsa alla familjers uppgifter
- sätta `matched_tutor_id` på sig själv och därmed läsa en studiehjälpares uppgifter
- som studiehjälpare sätta `status = 'approved'` på sig själv och publicera sig utan att ni godkänt något

Postgres RLS kan inte begränsa enskilda kolumner, så lösningen är två triggers som helt enkelt vägrar ändra de känsliga fälten om den som kör inte är admin. Table Editor påverkas inte, den går via `service_role`.

## Vad som fortfarande saknas

- **Betalning.** Familjen betalar varje pass med kort, före passet, genom Stripe
  (se `DEPLOY-BETALNING.md` avsnitt 9). Det finns ingen månadsfaktura till familjen
  sedan Fas 14.2. Kortvägen är driftsatt, men ingen betalning har gått igenom än,
  och spärren som stoppar ett obetalt pass är av tills en provbetalning fungerat.
  Utbetalningarna till studiehjälparna: underlaget går att mejla, själva
  överföringen gör ni från banken den 25:e.
- **AI-återkopplingen är inte deployad.** Koden finns i `supabase/functions/generate-feedback/`, se `DEPLOY-AI-FUNKTION.md`. Tills den är uppe visas studiehjälparens råa anteckningar rakt av för föräldern. Det är en fallback, inte ett fel.
- **Notiser.** Ingen får mejl när något händer. Ni får kolla adminvyn.
- **Hero-videon i vyerna.** De inloggade vyerna letar efter
  `bilder/hero-studievy.mp4` och visar hero-fotot så länge filen inte
  finns. Läggs filen dit spelas den, utan att någon rad kod behöver ändras.
- **Google Workspace.** Adminvyn har en statusflik, men det är inte
  kopplat. Vad som krävs står i `INTEGRATIONER.md`. Bokföringen,
  fakturorna och lönen sköts i Fortnox, utan koppling hit (Fas 14.9).
- **Bilder.** Studiehjälparna visas med en generisk siluett, inte riktiga foton.
- **Skatt och anställning av minderåriga.** Fortfarande olöst. Prata med en revisor innan första utbetalningen, inte efter.
- **Bakgrundskontroller.** Ni godkänner manuellt, men det finns ingen process bakom knappen än.
