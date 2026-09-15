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

### ⚠ Hemligheten är just nu själva kommandot, inte dess utdata

Både secreten och webhook-headern är satta till den bokstavliga
strängen `openssl rand -hex 32`. Kommandot kopierades in i stället för
att köras. Notiserna fungerar — de två strängarna matchar varandra —
men skyddet är borta: vem som helst som ser den här filen kan anropa
funktionen och fylla era tre inkorgar.

Byt så här, och gör stegen i den här ordningen:

1. Kör `openssl rand -hex 32` **i en terminal** och kopiera de 64
   tecknen den skriver ut.
2. Project Settings → Edge Functions → Secrets → sätt
   `NOTIS_HEMLIGHET` till den strängen.
3. Först därefter, byt headern i webhooken (steg 4 nedan) till samma
   sträng.

Gör ni 3 före 2 svarar funktionen 401 på varje anmälan som kommer in
emellan, och de mejlen kommer aldrig. Raderna ligger kvar i `leads`,
så ingenting går förlorat — men ni får inte veta om dem.

---

## 4. Databaswebhook

Database → Webhooks → Create a new hook:

- **Name:** `ny-intresseanmalan`
- **Table:** `public.leads`
- **Events:** ✅ Insert (bara Insert)
- **Type:** Supabase Edge Functions
- **Edge Function:** `lead-notis`
- **HTTP Headers:** lägg till `x-nextrum-notis` med hemligheten från steg 3

Webhooken finns redan och heter `ny-intresseanmalan`. Ska bara headern
bytas går det från SQL Editor, utan att röra resten:

```sql
create or replace trigger "ny-intresseanmalan"
  after insert on public.leads
  for each row execute function supabase_functions.http_request(
    'https://ddkfiuvcppalutfulvbi.supabase.co/functions/v1/lead-notis',
    'POST',
    '{"x-nextrum-notis":"DIN-NYA-HEMLIGHET-HAR"}',
    '{}',
    '5000'
  );
```

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
