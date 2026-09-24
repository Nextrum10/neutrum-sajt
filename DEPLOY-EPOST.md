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

## 5. Loggan i inkorgen

Två olika saker kallas "loggan i mejlet":

- **Loggan i själva brevet** finns redan. Märket ritas som en
  tabellcell i `_delad/notiser/rendera.ts`, med flit text och inte
  bild — kommentaren där säger varför.
- **Den runda bilden bredvid avsändaren i inkorgen** är i dag en
  bokstav i en färgad cirkel. Den styrs inte av mejlet alls. Varje
  mejlprogram har sin egen regel för den, och ingen av dem går att
  uppfylla med kod i det här repot:

| Program | Kräver | Kostar | Går det i dag? |
|---|---|---|---|
| Gmail | BIMI + DMARC `quarantine` + certifikat (VMC eller CMC) | certifikatet, varje år | **Nej**, se nedan |
| Apple Mail (iPhone, Mac) | Branded Mail i Apple Business Connect + DKIM + DMARC `quarantine` | ingenting | Om Branded Mail finns för svenska företag |
| Yahoo, AOL | BIMI + DMARC `quarantine` | ingenting | Knappt. Utan certifikat visas loggan bara för avsändare med stor volym |
| Outlook, Hotmail | Går inte. Microsoft stöder inte BIMI | — | Nej |

### Gmail kräver ett certifikat, och inget av dem går att få nu

- **VMC** (Verified Mark Certificate) kräver att märket är ett
  **registrerat varumärke** hos PRV eller EUIPO. Ger också Gmails
  blå bock.
- **CMC** (Common Mark Certificate) kräver inget varumärke, men att
  märket **synts på domänen i minst tolv månader**, kontrollerat mot
  Internet Archive. nextrum.se har visat det sedan september 2026, så
  **tidigast hösten 2027**.

Båda gäller i högst 397 dagar och förnyas varje år. De säljs av
bland andra DigiCert och Sectigo; kontrollera priset där. Det är
ingen småsumma för en läxhjälpsförmedling, och vinsten är en ikon.

### Det gratis försöket i Gmail

Gmail kan visa profilbilden på ett Google-konto bredvid mejl från
den adressen. `info@nextrum.se` ligger i Google Workspace. Ladda upp
`bilder/nextrum-logo-profil.png` som profilbild på det kontot
(myaccount.google.com → Personlig information → Profilbild) och se om
den syns på kvittot efter nästa intresseanmälan.

**Ingen garanti.** Google skriver inte ut när en profilbild visas för
mottagare utanför organisationen. Och det gäller bara adresser som är
ett riktigt konto: är `no-reply@nextrum.se` bara en avsändare hos
Resend finns det ingen profil att sätta en bild på.

### Första steget, oavsett väg: DMARC på `quarantine`

Allt ovan utom Outlook kräver det. **Och det är värt att göra även
utan logga.** Med `p=none` kan vem som helst skicka mejl som ser ut
att komma från `no-reply@nextrum.se` — och därifrån skickar vi
fakturor. En falsk faktura med ett annat kontonummer, från en äkta
avsändare, är precis det bedrägeri DMARC finns till för.

1. **En post, inte två** (avsnitt 1). Två DMARC-poster är noll, och
   då spelar det ingen roll vad någon av dem säger.
2. **Läs rapporterna först.** De kommer till `info@nextrum.se` via
   `rua`. Allt legitimt ska passera: Resend (DKIM på
   `resend._domainkey`) och det ni skickar från Gmail. Slå på DKIM i
   Workspace om det inte är gjort (admin.google.com → Appar →
   Google Workspace → Gmail → Autentisera e-post) — annars vilar
   mejlen från info@ på SPF ensam, och SPF går sönder när ett mejl
   vidarebefordras.
3. **Byt posten** till:
   ```
   v=DMARC1; p=quarantine; pct=100; rua=mailto:info@nextrum.se
   ```

### BIMI-posten

Filen finns: `bilder/nextrum-logo-bimi.svg`. BIMI kräver formatet
SVG Tiny PS (`baseProfile="tiny-ps"`, en `<title>`, inga skript,
inga externa referenser, kvadratisk), och en vanlig SVG underkänns.
Den har en hel fyrkantig bakgrund i stället för `favicon.svg`s
rundade: mejlprogrammen beskär själva, till cirkel eller rundad ruta,
och ett genomskinligt hörn visas annars mot vad programmet råkar ha
bakom.

Lägg in den i Cloudflare **efter** DMARC-steget. Före det gör den
ingenting:

| Typ | Namn | Innehåll |
|---|---|---|
| TXT | `default._bimi` | `v=BIMI1; l=https://nextrum.se/bilder/nextrum-logo-bimi.svg;` |

Utan certifikat ger posten nästan ingenting för de mottagare vi har.
Kommer ett certifikat läggs `a=` med adressen till dess `.pem` till i
samma post.

### Apple Branded Mail

Gratis, och Apple Mail är det många föräldrar läser i. Kräver DKIM
(finns via Resend) och DMARC `quarantine`. Loggan laddas upp i Apple
Business Connect som en kvadratisk bild på 1024–4864 pixlar:
`bilder/nextrum-logo-profil.png` är 1024. Apple listar inte vilka
länder Branded Mail finns i — logga in och se om valet dyker upp.

**Byts märket** måste `nextrum-logo-bimi.svg` och
`nextrum-logo-profil.png` ritas om för hand. `verktyg/satt-logga.py`
rör bara sajtens ikoner.

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
