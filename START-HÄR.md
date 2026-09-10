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
| `schema.sql` → … → `schema-v13.sql` | Databasen. Kör i nummerordning. |

---

## Steg 1 — kör de tre SQL-filerna

Supabase → **SQL Editor** → New query. Klistra in **en fil i taget**, i
nummerordning, och tryck Run mellan varje: `schema.sql`, `schema-v2.sql`,
… fram till `schema-v13.sql`.

Kör du dem i fel ordning får du fel om saknade tabeller. Kör om
`schema.sql` bara om du vill börja om från noll, den rensar tabellerna
först.

**`schema-v13.sql` är den senaste och behövs för adminvyn.** Utan den
fungerar sidan, men nyckeltalen saknas, statusarna går inte att ändra och
anteckningarna går inte att spara — vyn säger till vilken fil som saknas i
stället för att visa nollor.

## Steg 2 — klistra in nycklarna

Supabase → **Project Settings → API**. Du behöver två saker:

- **Project URL** (ser ut som `https://abcdefgh.supabase.co`)
- Nyckeln under "Project API keys" som heter **`anon`** / `public`

Öppna `nextrum-config.js` i en texteditor, byt ut de två platshållarna, spara.

> Nyckeln som heter `service_role` ska **aldrig** in i någon av dessa filer. Den ger full åtkomst till allt och ligger i webbläsaren där vem som helst kan läsa den.

## Steg 3 — testa

Öppna `index.html` i webbläsaren. Kolla att sektionen "Några av dem som hjälper till" säger *"Inga studiehjälpare är publicerade än"* och inte *"Databasen är inte kopplad"*. Säger den det senare är steg 2 inte klart.

**Viktigt:** en Claude-artefaktlänk (`claude.ai/...`) kan aldrig prata med Supabase, den blockerar externa anrop av säkerhetsskäl. Testa alltid mot den riktiga filen, eller lägg upp mappen på Netlify Drop (gratis, dra in mappen, klart).

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
admin. Triggern i `schema-v3.sql` vägrar ändra `is_admin` från en inloggad
session, och det är med flit: den som kan göra sig själv till admin i sin
egen vy är inte begränsad av något.

---

## Två säkerhetshål som fixades i `schema-v3.sql`

Värt att förstå, för det förklarar varför filen finns.

De gamla reglerna sa "du får uppdatera din egen rad", men sa ingenting om **vilka fält**. Alltså kunde vem som helst med ett konto:

- sätta `is_admin = true` på sig själv och läsa alla familjers uppgifter
- sätta `matched_tutor_id` på sig själv och därmed läsa en studiehjälpares uppgifter
- som studiehjälpare sätta `status = 'approved'` på sig själv och publicera sig utan att ni godkänt något

Postgres RLS kan inte begränsa enskilda kolumner, så lösningen är två triggers som helt enkelt vägrar ändra de känsliga fälten om den som kör inte är admin. Table Editor påverkas inte, den går via `service_role`.

## Vad som fortfarande saknas

- **Betalning.** Ingen Stripe. Priset visas men inga pengar rör sig. Sköts utanför plattformen tills vidare.
- **AI-återkopplingen är inte deployad.** Koden finns i `supabase/functions/generate-feedback/`, se `DEPLOY-AI-FUNKTION.md`. Tills den är uppe visas studiehjälparens råa anteckningar rakt av för föräldern. Det är en fallback, inte ett fel.
- **Notiser.** Ingen får mejl när något händer. Ni får kolla adminvyn.
- **Hero-videon i vyerna.** De inloggade vyerna letar efter
  `bilder/hero-studievy.mp4` och visar hero-fotot så länge filen inte
  finns. Läggs filen dit spelas den, utan att någon rad kod behöver ändras.
- **Google Workspace och Fortnox.** Adminvyn har en statusflik för båda,
  men ingen av dem är kopplad. Vad som krävs står i `INTEGRATIONER.md`.
- **Bilder.** Studiehjälparna visas med en generisk siluett, inte riktiga foton.
- **Skatt och anställning av minderåriga.** Fortfarande olöst. Prata med en revisor innan första utbetalningen, inte efter.
- **Bakgrundskontroller.** Ni godkänner manuellt, men det finns ingen process bakom knappen än.
