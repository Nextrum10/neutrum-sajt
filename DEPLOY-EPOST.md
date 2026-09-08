# Intresseanmälan → info@nextrum.se

Funktionen `lead-notis` är byggd och driftsatt. Den mejlar er varje
gång någon skickar en intresseanmälan. Fyra steg återstår, och tre av
dem kräver konton eller DNS som bara ni kommer åt.

Anmälan sparas i databasen precis som förut. Det här är en avisering
ovanpå — går mejlet fel ligger raden kvar i `leads`.

---

## 1. SPF och DMARC saknas i DNS (gör detta oavsett)

MX pekar på Google Workspace och DKIM är uppsatt, men det finns
**ingen SPF-post** och **ingen DMARC-post** för nextrum.se. Utan SPF
kan mottagare avvisa eller skräppostmärka post som skickas från
@nextrum.se — även den ni skriver för hand från Gmail.

Lägg till i Cloudflare (DNS → Records):

| Typ | Namn | Innehåll |
|-----|------|----------|
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@nextrum.se` |

`p=none` betyder "rapportera men blockera inte". Börja där. När ni
sett ett par veckors rapporter och vet att allt legitimt går igenom
kan ni skärpa till `p=quarantine`.

Kontrollera efteråt:

```bash
dig +short nextrum.se TXT; dig +short _dmarc.nextrum.se TXT
```

---

## 2. Resend: konto och domän

1. Skapa konto på resend.com.
2. Lägg till domänen `nextrum.se`.
3. Resend ger er 2–3 DNS-poster (en DKIM-post och en för retursökväg).
   Lägg in dem i Cloudflare och vänta på att Resend visar *Verified*.

Domänen måste vara verifierad. Utan det vägrar Resend skicka med
`no-reply@nextrum.se` som avsändare, och funktionen svarar 502.

**Obs om SPF:** har ni redan SPF-posten från steg 1 ska ni inte lägga
till en andra. En domän får bara ha **en** SPF-post. Behöver Resend
komma med i den slås de ihop till en rad:

```
v=spf1 include:_spf.google.com include:amazonses.com ~all
```

Resend visar vilken `include` som gäller när ni lägger till domänen.

---

## 3. Två secrets i Supabase

Project Settings → Edge Functions → Secrets:

| Namn | Värde |
|------|-------|
| `RESEND_API_KEY` | API-nyckeln från Resend |
| `NOTIS_HEMLIGHET` | En lång slumpsträng ni hittar på själva |

Generera hemligheten med:

```bash
openssl rand -hex 32
```

Den finns för att funktionen ska kunna skilja ett riktigt
webhook-anrop från vem som helst som hittat adressen. Spara den — ni
behöver samma sträng i steg 4.

---

## 4. Databaswebhook

Database → Webhooks → Create a new hook:

- **Name:** `ny-intresseanmalan`
- **Table:** `public.leads`
- **Events:** ✅ Insert (bara Insert)
- **Type:** Supabase Edge Functions
- **Edge Function:** `lead-notis`
- **HTTP Headers:** lägg till `x-nextrum-notis` med hemligheten från steg 3

### Varför en webhook och inte ett anrop från formuläret

En funktion som tar emot formulärdata från webbläsaren är en öppen
väg att fylla er inkorg. Adressen står i JavaScript på en publik sida
— vem som helst kan läsa den och anropa den i en slinga.

Webhooken körs på Supabases sida först när raden faktiskt skapats. Det
som mejlas är alltid något som verkligen står i databasen, och
funktionen är aldrig åtkomlig utifrån utan hemligheten.

---

## Testa

Skicka en riktig intresseanmälan på nextrum.se. Kom det inget mejl:

- **Database → Webhooks → Logs** visar om webhooken avfyrades och vad
  funktionen svarade.
- `401 Fel eller saknad hemlighet` → headern i steg 4 stämmer inte med
  secreten i steg 3.
- `502 Resend svarade…` → domänen är inte verifierad än, eller
  nyckeln är fel.
- Inget alls i loggen → webhooken är inte påslagen, eller lyssnar på
  fel tabell.
