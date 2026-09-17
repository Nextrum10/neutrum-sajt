# Intresseanmälan → notis till ledningen

Funktionen `lead-notis` är byggd och driftsatt. Den mejlar er varje
gång någon skickar en intresseanmälan.

| | |
|---|---|
| Avsändare | `Nextrum <info@nextrum.se>` |
| Mottagare | `alexandarjovanoviccc@gmail.com`, `leo.thriskos@gmail.com`, `info@nextrum.se` |
| Svara-knapp | går till familjen, inte till oss |

Alla tre får samma mejl med flit. Den som ser det först kan ringa, och
24-timmarslöftet på sajten håller inte om aviseringen ligger i en
inkorg ingen öppnar förrän på måndag.

Vill ni ändra listan står den i `TILL` överst i
`supabase/functions/lead-notis/index.ts`. Funktionen måste driftsättas
om efteråt — det räcker inte att ändra i repot.

Anmälan sparas i databasen precis som förut. Det här är en avisering
ovanpå — går mejlet fel ligger raden kvar i `leads`.

---

## 1. SPF och DMARC — KLART, men en post för mycket

Posterna är inlagda i Cloudflare:

| Typ | Namn | Innehåll |
|-----|------|----------|
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@nextrum.se` |

`p=none` betyder "rapportera men blockera inte". Börja där. När ni
sett ett par veckors rapporter och vet att allt legitimt går igenom
kan ni skärpa till `p=quarantine`.

### ⚠ Det ligger TVÅ DMARC-poster på `_dmarc`

Den ena är `v=DMARC1; p=none;` utan rapportadress, den andra är raden
i tabellen ovan. **Ta bort den utan `rua=`.**

Två poster är inte "dubbelt så mycket DMARC" — det är noll. Hittar en
mottagare mer än en giltig DMARC-post på namnet ska hela kontrollen
hoppas över (RFC 7489, avsnitt 6.6.3). Domänen står alltså utan
DMARC så länge båda ligger kvar, och rapporterna ni satte upp `rua`
för kommer aldrig.

Kontrollera efteråt att BARA en rad kommer tillbaka:

```bash
dig +short _dmarc.nextrum.se TXT
```

---

## 2. Resend: konto och domän — KLART

Domänen är verifierad och funktionen skickar skarpt från
`info@nextrum.se`. Så här ser den ut, region **Irland
(eu-west-1)**:

| Typ | Namn | Innehåll |
|-----|------|----------|
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com`, prioritet 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | `p=…` från Resend |

### ⚠ Två fällor, båda kostade en hel kväll

**Läs domännamnet bokstav för bokstav.** Domänen som först lades till
hos Resend hette `neutrum.se`, inte `nextrum.se`. `neutrum.se` är en
riktig men främmande domän som ligger hos Loopia, så Resend letade
efter posterna där medan de låg hos Cloudflare — och verifieringen
kunde aldrig gå igenom. Ledtråden stod i Resends egen panel: den skrev
*Provider: Loopia* där det skulle ha stått Cloudflare. Felmeddelandet
sa hela tiden sanningen, att *nextrum.se* inte var tillagd. Repot
heter dessutom `neutrum-sajt`, så stavfelet är ett mönster här.

**En CNAME kan inte samsas med andra poster på samma namn.** Det låg
en CNAME på `send` från en äldre uppsättning. Den MÅSTE tas bort innan
MX- och TXT-posterna ovan kan läggas till — annars vägrar Cloudflare,
eller så ligger den kvar och blockerar tyst. Samma sak gällde en
`rsend`-CNAME som inte längre står i Resends lista.

### Rör INTE SPF-posten på roten

Det är lätt att tro att Resend ska läggas till där. Det ska de inte.
SPF kontrolleras mot retursökvägen, inte mot det som står i
Från-fältet, och Resends retursökväg är `send.nextrum.se` med sin egen
SPF-post. Kedjan går ihop utan roten.

Roten ska därför fortsätta säga bara `include:_spf.google.com`. Den
gäller posten ni skriver för hand från Gmail. Lägger ni till Resend
där löser det ingenting och tar en av de tio DNS-uppslag en SPF-post
får kosta innan den underkänns.

Kontrollera hela kedjan så här — alla fyra ska svara:

```bash
dig +short send.nextrum.se MX
dig +short send.nextrum.se TXT
dig +short resend._domainkey.nextrum.se TXT
dig +short nextrum.se TXT
```

### Reservavsändaren

`lead-notis` provar `info@nextrum.se` först och faller bara vid 403
tillbaka på `onboarding@resend.dev`. Den är vilande nu och kostar
ingenting, men fångar samma fel igen om domänen någon gång faller ur.
Ser ni `"reserv": true` i svaret är domänen inte verifierad längre.

**Reserven går bara till `info@nextrum.se`, inte till hela listan.**
`onboarding@resend.dev` får bara leverera till Resend-kontots egen
adress, så ett försök med tre mottagare hade avvisats i sin helhet och
reserven vore meningslös. Är kontot registrerat på någon av
gmail-adresserna i stället faller även reserven — men då står orsaken
i svaret, i stället för att aviseringen försvinner tyst.

---

## 3. En secret i Supabase

Project Settings → Edge Functions → Secrets:

| Namn | Värde |
|------|-------|
| `RESEND_API_KEY` | API-nyckeln från Resend |

Det är den enda som behövs. `SUPABASE_URL` och
`SUPABASE_SERVICE_ROLE_KEY` injicerar Supabase själv i varje Edge
Function.

### `NOTIS_HEMLIGHET` är avvecklad — ta bort den

Den delade hemligheten ligger nu i tabellen `public.notis_konfig`
(`supabase/migrations/arkiv/schema-v17.sql`), inte i en secret. Funktionen läser den med
service_role-nyckeln vid kall start och cachar den sedan.

Secreten `NOTIS_HEMLIGHET` används inte längre av någon kod. **Radera
den** i Supabase-panelen så att ingen tror att den betyder något.

#### Varför den flyttades

Den var satt till den bokstavliga strängen `openssl rand -hex 32`.
Kommandot hade klistrats in i stället för körts, och webhookens header
var satt till exakt samma sträng. Notiserna fungerade — de två
matchade varandra — men skyddet var noll: vem som helst som sett den
här filen kunde anropa funktionen och fylla alla tre inkorgarna med
påhittade anmälningar.

En secret går bara att byta i panelen, och headern bara i databasen.
Två fönster, två steg, fel ordning ger 401 på varje anmälan som kommer
in emellan. I en tabell byts båda i samma transaktion i stället.

Tabellen har RLS på utan en enda policy, så `anon` och `authenticated`
får noll rader. Databaslintern flaggar det som INFO — det är avsikten,
precis som för `fortnox_token`.

#### Rotera hemligheten

Hela blocket ligger längst ned i `supabase/migrations/arkiv/schema-v17.sql`. Kör det i SQL
Editor: det byter tabellen och webhookens header i samma transaktion,
och värdet syns aldrig på skärmen.

---

## 4. Databaswebhook

Database → Webhooks → Create a new hook:

- **Name:** `ny-intresseanmalan`
- **Table:** `public.leads`
- **Events:** ✅ Insert (bara Insert)
- **Type:** Supabase Edge Functions
- **Edge Function:** `lead-notis`
- **HTTP Headers:** lägg till `x-nextrum-notis` med hemligheten ur
  `public.notis_konfig`

Webhooken finns redan och heter `ny-intresseanmalan`, med rätt header.
Sätt den inte för hand igen — använd roteringsblocket i
`supabase/migrations/arkiv/schema-v17.sql`, som skriver både tabellen och headern på en gång.

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
- `401 Fel eller saknad hemlighet` → headern i webhooken stämmer inte
  med raden i `public.notis_konfig`. Kör roteringsblocket i
  `supabase/migrations/arkiv/schema-v17.sql`, så sätts båda om.
- `503 Hemligheten gick inte att läsa` → tabellen `notis_konfig` är
  tom eller borta. Kör `supabase/migrations/arkiv/schema-v17.sql`.
- `502 Resend svarade…` → domänen är inte verifierad än, eller
  nyckeln är fel.
- Inget alls i loggen → webhooken är inte påslagen, eller lyssnar på
  fel tabell.
