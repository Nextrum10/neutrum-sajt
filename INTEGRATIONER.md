# Google Workspace och Fortnox

Adminsidan har en flik som heter **System → Integrationer**. Den visar om
tjänsterna är kopplade. Just nu är svaret nej för båda, och det står så.

Den här filen säger vad som saknas och varför det inte går att klicka sig
fram till det.

---

## Varför det inte finns en "Koppla"-knapp

Båda tjänsterna kräver en **klienthemlighet**. En hemlighet som webbläsaren
kan läsa är ingen hemlighet — den ligger då hos varenda person som öppnar
sidan, inklusive den som öppnar utvecklarverktygen.

Alltså:

- Nycklarna sätts som **secrets på en edge-funktion** i Supabase. Dit når
  ingen webbläsare.
- Tabellen `integrationer` (schema-v13.sql) innehåller **bara status**: om
  det är kopplat, mot vilket konto, när synken kördes och vad den sa.
- Tabellen har medvetet **ingen skrivpolicy alls**. Raderna sätts av
  edge-funktionen med `service_role`, som går förbi RLS. Kan ingen skriva
  från webbläsaren kan ingen få något att *se* kopplat ut som inte är det.

Adminsidan rapporterar. Den kopplar inte.

---

## Fortnox — bokföringen

### Vad kopplingen ska göra

Månadskörningen (`supabase/functions/fakturering`) skapar redan två saker
av varje genomfört pass:

| Vår tabell | Vad det är | Motsvarighet i Fortnox |
|---|---|---|
| `invoices` + `invoice_lines` | vad familjen ska betala | kundfaktura (`/3/invoices`) |
| `payouts` + `payout_lines` | vad studiehjälparen ska få | leverantörsfaktura (`/3/supplierinvoices`) |

Kopplingen speglar dem, så att ingen knappar in samma siffra två gånger.

### Vad ni behöver skaffa

1. **Integrationslicens** i Fortnox (kostar per månad, beställs i deras
   kundportal).
2. En **app** i Fortnox Developer Portal med scope `invoice` och
   `supplierinvoice`, plus `companyinformation` för att kunna visa vilket
   bolag som är kopplat.
3. Godkänn appen mot ert eget bolag en gång. Det ger en
   `authorization_code` som växlas in mot ett **refresh token**.

### Vad som ska bli secrets

```
FORTNOX_KLIENT_ID
FORTNOX_KLIENT_HEMLIGHET
FORTNOX_REFRESH_TOKEN
```

Sätt dem med `supabase secrets set` — aldrig i `nextrum-config.js`, aldrig
i en tabell.

### Hur token fungerar

Fortnox roterar refresh-token vid varje användning. Det är den fällan som
gör att integrationer slutar fungera efter en månad: man sparar det gamla,
använder det en gång till, och blir utlåst.

Alltså måste edge-funktionen **spara det nya refresh-token** direkt efter
varje växling. Det ska ligga i en tabell som bara `service_role` når, inte
i en secret (secrets går inte att skriva från en funktion).

### Anropen

```
POST https://apps.fortnox.se/oauth-v1/token
  grant_type=refresh_token&refresh_token=<det sparade>
  Authorization: Basic base64(klient_id:klient_hemlighet)
  → { access_token, refresh_token }   ← spara det NYA refresh_token direkt

POST https://api.fortnox.se/3/invoices
  Authorization: Bearer <access_token>
  { "Invoice": { "CustomerNumber": …, "InvoiceDate": …, "DueDate": …,
                 "InvoiceRows": [ { "Description": …, "DeliveredQuantity": …,
                                    "Price": … } ] } }
```

`invoice_lines.beskrivning` blir `Description`, `minuter / 60` blir
`DeliveredQuantity`, `pris_per_timme_ore / 100` blir `Price`. Beloppen i
våra tabeller är i **ören**; Fortnox räknar i kronor. Den omvandlingen är
det enda stället ett avrundningsfel kan smyga sig in, så gör den en gång
och på ett ställe.

### Ordningen att bygga i

1. Token-växlingen, med sparandet av det nya refresh-token. Fungerar inte
   den fungerar ingenting, och felet visar sig först nästa månad.
2. En torrkörning som svarar med vad som *skulle* skickas.
3. Skarp körning för **en** faktura.
4. Skriv tillbaka `integrationer.senaste_synk` och eventuellt
   `senaste_fel`, så adminsidan säger sanningen.

---

## Google Workspace — kalender och mejl

### Vad kopplingen ska göra

- **Kalender.** Ett bekräftat pass blir en händelse hos både familjen och
  studiehjälparen, med Meet-länk om formatet är online. Avbokas passet
  försvinner händelsen.
- **Mejl.** Fakturautskicket och notiserna går från en riktig adress
  (`info@nextrum.se`) i stället för en no-reply hos någon annan.

### Vad ni behöver skaffa

1. Ett **Google Cloud-projekt** med **Calendar API** och **Gmail API**
   påslagna.
2. Ett **tjänstekonto** med **domänvid delegering** (domain-wide
   delegation), godkänt i Google Workspace Admin under
   *Säkerhet → API-kontroller → Domänvid delegering*.
3. Scopes:
   ```
   https://www.googleapis.com/auth/calendar.events
   https://www.googleapis.com/auth/gmail.send
   ```

### Vad som ska bli secrets

```
GOOGLE_TJANSTEKONTO_JSON     (hela nyckelfilen, som en sträng)
GOOGLE_DELEGERAD_ANVANDARE   (t.ex. info@nextrum.se)
```

### Den viktiga begränsningen

Tjänstekontot får bara skriva i kalendrar inom **er egen domän**. En familj
med en privat Gmail-adress är inte i er domän, så deras kalender kan ni inte
skriva i utan att de själva loggar in och godkänner det (vanlig OAuth med
samtycke, en helt annan sak än tjänstekonto).

Praktiskt betyder det:

- **Studiehjälparen** kan få händelser direkt, om ni ger dem
  Workspace-konton.
- **Familjen** får en `.ics`-inbjudan i mejlet i stället. Den fungerar i
  alla kalendrar och kräver inget konto hos er.

Bygg det andra först. Det är det som gäller de flesta, och det kräver inget
utöver Gmail-scopet.

### Redan skrivet

`GOOGLE.md` beskriver Google-uppsättningen för sajtens övriga delar. Läs den
först — projekt och behörigheter är delvis samma sak.

---

## När något är kopplat

Edge-funktionen skriver, med `service_role`:

```sql
update public.integrationer
   set kopplad = true,
       konto = 'Nextrum AB (556xxx-xxxx)',
       kopplad_at = now(),
       senaste_synk = now(),
       senaste_fel = null,
       uppdaterad = now()
 where tjanst = 'fortnox';
```

Går en synk fel: lämna `kopplad` som den är och sätt `senaste_fel`. En
misslyckad synk betyder inte att kopplingen är borta, och att sätta
`kopplad = false` vid varje hicka gör statusen oläsbar.

Adminsidan läser raden och visar den. Den gissar aldrig.
