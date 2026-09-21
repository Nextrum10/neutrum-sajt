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

## 1. DNS för nextrum.se: läget 21 september 2026

Avläst med `dig` mot både 1.1.1.1 och 8.8.8.8, samma svar från båda.
DNS ligger hos Cloudflare.

Två tjänster skickar i nextrum.se:s namn, och de har var sin väg:

| Tjänst | Används till | Envelope-from | DKIM |
|---|---|---|---|
| Google Workspace | mejl ni skriver för hand från info@ | `nextrum.se` | `google._domainkey` |
| Resend (Amazon SES, eu-west-1) | lead-notis, pass-notis, meddelande-notis, faktura-utskick | `send.nextrum.se` | `resend._domainkey` |

### Posterna, en och en

| Typ | Namn | Värde | Läge |
|---|---|---|---|
| MX | `@` | `1 smtp.google.com` | ✅ rätt |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | ✅ rätt, exakt en SPF-post |
| MX | `send` | `10 feedback-smtp.eu-west-1.amazonses.com` | ✅ rätt |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | ✅ rätt |
| TXT | `google._domainkey` | `v=DKIM1;k=rsa;p=MIIBIjAN…` (2048 bitar) | ✅ finns, se nedan |
| TXT | `resend._domainkey` | **TVÅ olika nycklar** | ❌ **FEL, måste rättas** |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@nextrum.se` | ✅ exakt en post |

Den tidigare varningen om två DMARC-poster gäller inte längre. Det
svarar exakt en.

### ❌ Två DKIM-nycklar på `resend._domainkey`

```
"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC/zOTYx61IezWFZrxJjDuie2tdc5…"
"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDsAOEpkj9Khe4z0utyU1UqW0zJo5…"
```

Två poster på samma selektor är inte dubbelt skydd. RFC 6376 säger
att posterna MÅSTE vara unika per selektor, annars är resultatet
odefinierat: mottagaren väljer EN av dem. Väljer den fel underkänns
DKIM för allt som går via Resend, alltså fakturor och alla notismejl.

I dag räddas DMARC av att SPF för `send.nextrum.se` räknas som
linjerat. Men ett vidarebefordrat mejl, till exempel till ett
skolkonto, faller på SPF — och då står bara DKIM kvar. Därför måste
det här rättas **innan** DMARC skärps.

**Så rättas det:**

1. Logga in på Resend → **Domains** → `nextrum.se` → **DKIM**. Kopiera
   värdet som står där.
2. I Cloudflare → DNS → `nextrum.se`: behåll den `resend._domainkey`-post
   som är exakt lika med värdet från Resend. **Radera den andra.**
3. Kontrollera att bara en rad svarar:
   ```bash
   dig +short TXT resend._domainkey.nextrum.se @1.1.1.1
   ```
4. Se att Resend fortfarande visar domänen som *Verified*.

En trolig men **inte bekräftad** förklaring är att den ena nyckeln
kommer från försöket med `neutrum.se` (se fällorna i avsnitt 3).

### Google DKIM: finns i DNS, men är signeringen på?

Nyckeln på `google._domainkey` är rätt skriven. Om Google faktiskt
SIGNERAR med den syns bara i Google Admin → Appar → Google Workspace →
Gmail → **Autentisera e-post**. Står det inte *Autentiserar e-post*,
tryck *Starta autentisering*.

### SPF: ingen ändring behövs

Regeln är en enda `v=spf1`-post per namn. Tillkommer en tjänst som
skickar med envelope-from `@nextrum.se`, läggs dess `include:` in i
**samma** rotpost. Resend ska INTE in i roten — se avsnitt 3.

`~all` räcker. Det är DMARC som blockerar, inte SPF. Byt inte till
`-all` under utrullningen.

---

## 2. DMARC: från p=none till quarantine

### Steg 1, nu

```
TXT  _dmarc  v=DMARC1; p=none; rua=mailto:<RAPPORTADRESS>; pct=100; adkim=r; aspf=r
```

TTL 300 under utrullningen, så att ett steg går att backa inom
minuter. 3600 när slutläget är nått.

Den nuvarande posten gör i praktiken redan detta — `r`, `r` och `100`
är standardvärden. Den behöver bara bytas om rapportadressen byts.

**`aspf=r` är ett krav, inte ett förval.** Resends envelope-from ligger
på `send.nextrum.se`, alltså en underdomän. Med `aspf=s` (strikt)
underkänns SPF för varenda Resend-mejl.

**Rapportadressen är ett beslut för Leo.** Rapporterna går i dag till
`info@nextrum.se`, samma inkorg som lead-aviseringar och fakturasvar.
De kommer som dagliga XML-bilagor från varje stor mottagare, och i
den inkorgen blir de brus som ingen läser. Förslag: en egen adress,
`dmarc@nextrum.se`, som grupp eller alias i Workspace. Den ligger i
samma domän och kräver ingen extra behörighetspost.

### Innan steg 2 ska allt detta vara sant

- [ ] Exakt en post på `resend._domainkey`, och Resend visar *Verified*
- [ ] Google Admin visar *Autentiserar e-post*
- [ ] Det är avgjort hur Supabase Auth skickar sina mejl (se nedan)
- [ ] Ett testmejl från varje väg — Gmail från info@, lead-notis,
      pass-notis, en faktura — till en extern Gmail-adress visar under
      *Visa original*: `SPF: PASS`, `DKIM: PASS` med
      `header.d=nextrum.se`, och `DMARC: PASS`
- [ ] 2–4 veckors rapporter där Google och Amazon SES eu-west-1 klarar
      DMARC och ingen okänd **legitim** avsändare underkänns

### Steg 2: quarantine, i tre nivåer

```
v=DMARC1; p=quarantine; pct=25;  rua=mailto:<RAPPORTADRESS>; adkim=r; aspf=r
v=DMARC1; p=quarantine; pct=50;  rua=mailto:<RAPPORTADRESS>; adkim=r; aspf=r
v=DMARC1; p=quarantine; pct=100; rua=mailto:<RAPPORTADRESS>; adkim=r; aspf=r
```

Ungefär en vecka per nivå. Höj bara när rapporterna inte visar några
legitima underkännanden och ingen hört av sig om mejl som inte kommit
fram. `pct` är ett önskemål till mottagaren, inte ett löfte — lita
på rapporterna, inte på procentsatsen.

### Steg 3: reject, valfritt

```
v=DMARC1; p=reject; pct=100; rua=mailto:<RAPPORTADRESS>; adkim=r; aspf=r
```

Tidigast efter fyra rena veckor på `quarantine` med `pct=100`, och när
vidarebefordrade mejl har visats klara sig på DKIM. Om ni stannar på
quarantine eller går hela vägen är Leos beslut.

Underdomäner ärver `p` eftersom `sp=` saknas. Det räcker: ingen
tjänst skickar med en underdomän som synlig avsändare.

### Öppna frågor som påverkar DMARC

**Supabase Auth.** Bekräftelsemejl vid registrering och inbjudningar
från `bjud-in` skickas av Supabase Auth, inte av Resend. Vilken SMTP
projektet använder går inte att läsa med de verktyg som finns här.
Står det på Supabases standard-SMTP gäller två saker: mejlen går bara
fram till adresser som är medlemmar i Supabase-organisationens team,
och de skickas från Supabases domän. En familj utanför teamet får då
aldrig sin inbjudan. Rätt lösning är egen SMTP via Resend
(`smtp.resend.com`, port 465, användare `resend`, lösenord =
API-nyckeln) under Authentication → Emails → SMTP Settings. nextrum.se
är redan verifierad hos Resend, så inga nya DNS-poster behövs.

**`no-reply@nextrum.se`.** pass-notis och meddelande-notis skickar
utan svarsadress, så ett svar går till `no-reply@`. Finns adressen
inte i Workspace studsar svaret. Antingen ett alias i Workspace, eller
`svaraTill: info@nextrum.se` i `_delad/notis.ts`.

---

## 3. Resend: konto och domän

Domänen är verifierad och funktionerna skickar skarpt. Region
**Irland (eu-west-1)**. Posterna står i tabellen i avsnitt 1.

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

Kontrollera hela kedjan så här — alla fyra ska svara, och
`resend._domainkey` med EXAKT EN rad (se avsnitt 1):

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

## 4. En secret i Supabase

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

## 5. Databaswebhook

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
