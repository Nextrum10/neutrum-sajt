# Mejlen från Nextrum

Tre utskick, två funktioner, en hemlighet:

| Vad | Till vem | Funktion | Utlöses av |
|---|---|---|---|
| Avisering om intresseanmälan | ledningen | `lead-notis` | webhook på `leads` |
| Kvittens på intresseanmälan | familjen | `lead-notis` | samma webhook |
| Notis ur appen | lärare eller familj | `notis-mejl` | trigger på `notiser` |

Alla tre använder brevmallen i `supabase/functions/_delad/mall.ts`.
Ska tonen, färgen eller foten ändras görs det där, en gång, för alla.

**Driftsättningsordning vid nästa release:**

```bash
supabase functions deploy notis-mejl
# och först DÄREFTER migrationen, se avsnitt 5
```

Funktionen måste finnas innan triggern pekar på den. En trigger mot
en adress som inte svarar sväljer felet tyst — notisen skrivs, mejlet
kommer aldrig, och ingenting ser trasigt ut.

---

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

---

# Kvittensen till familjen

`lead-notis` skickar sedan Fas 4.1 **två** mejl per anmälan:
aviseringen till er, och ett kvitto till den som fyllde i formuläret.

| | |
|---|---|
| Avsändare | `Nextrum <info@nextrum.se>` |
| Mottagare | adressen i anmälan |
| Svar går till | `info@nextrum.se` |
| Idempotensnyckel | `lead-kvittens-<rad-id>` |

**Aviseringen skickas först.** Den familjen inte får är en besviken
förälder; den ni inte får är en kund som hörde av sig och aldrig blev
uppringd. Ett fel på kvittensen kan därför inte fälla svaret — en 502
hade fått webhooken att försöka igen och skickat aviseringen en andra
gång. Utfallet står i stället i svaret:

```json
{ "ok": true, "id": "…", "kvittens": { "skickad": true, "id": "…" } }
```

Står det `"skickad": false` kom aviseringen fram men inte kvittensen.
Orsaken står bredvid. Vanligaste fallen:

- adressen i raden är inte en adress — inget att kvittera till
- domänen är inte verifierad hos Resend — se avsnitt 2

Inget mejl går till en adress som inte klarar `epostOk`. Raden ligger
kvar i `leads` oavsett.

---

# Notiser ur appen → `notis-mejl`

Sedan migrationen `20260919101500_fas4_1_notiser_som_tabell_och_mejl`
är en notis en rad i `public.notiser`. Triggrar på `bookings`,
`messages`, `lesson_reports` och `homework` skriver raden; en trigger
på `notiser` ropar på `notis-mejl`, som skickar mejlet.

| Typ | Går till | När |
|---|---|---|
| `pass_forslag` | familjen | studiehjälparen föreslår en tid |
| `pass_onskemal` | studiehjälparen | familjen önskar en tid |
| `meddelande` | motparten | någon skriver i tråden |
| `rapport` | familjen | rapporten efter passet är klar |
| `laxa` | familjen | ny uppgift till nästa gång |

`pass_onskemal` är den som saknades helt förut. En familj som önskade
en tid fick mejl när studiehjälparen svarade — men studiehjälparen som
skulle svara fick inget, och såg förfrågan först vid nästa inloggning.

## Vad som ändras i driften

`pass-notis` och `meddelande-notis` anropas inte längre. Migrationen
tar bort deras triggrar (`nytt-passforslag`, `nytt-meddelande`) i
samma körning som den lägger till de nya — ligger båda kvar får en
familj två mejl om samma händelse, från två funktioner med olika
formgivning.

**Ta inte bort funktionerna än.** De ligger kvar i repot och i
driften utan att kosta något. Behöver ni backa räcker det att köra
`supabase/migrations/arkiv/schema-v25.sql` igen och släppa de nya
triggrarna — en trigger går att sätta tillbaka på en driftsatt
funktion, inte på en raderad.

## Ingen brödtext i mejlen

Varken meddelandetexten, rapporten eller läxinstruktionen följer med.
Triggern skriver dem aldrig till `notiser.data`, så de finns inte att
läcka. Notisen säger att något kommit och vad det gäller; den som vill
läsa loggar in.

## Tystnadsfönster

`notis-mejl` skickar inte om mottagaren fått ett mejl av samma typ
inom 60 minuter. Notiserna ligger kvar allihop i tabellen — det är
bara aviseringen som hålls tillbaka. Siffran står i `TYST_MINUTER`
överst i funktionen.

## Om ett mejl inte kom

```sql
select typ, mottagare, mal, skapad, mejlad_at
  from public.notiser order by skapad desc limit 10;
```

- **Raden finns, `mejlad_at` är tom** → mejlet gick inte iväg. Titta i
  Edge Functions → `notis-mejl` → Logs. Raden går att skicka om.
- **Ingen rad alls** → triggern på källtabellen avfyrades inte.
  Kontrollera att den finns:
  ```sql
  select tgname from pg_trigger where tgname like 'notis-%';
  -- ska ge fem rader
  ```
- **`401`** → hemligheten i triggern stämmer inte med
  `public.notis_konfig`. Kör roteringsblocket i
  `supabase/migrations/arkiv/schema-v17.sql`, som sätter om allihop.

## Vyerna räknar fortfarande själva

`nextrum-larare-vy.js` och `nextrum-studie-vy.js` räknar fram sina
notiser ur bokningar och meddelanden i webbläsaren, precis som förut.
Tabellen driver mejlen; den driver ännu inte det som ritas på skärmen.

Följden: `last_at` sätts aldrig, eftersom ingenting markerar en notis
som läst än. Kolumnen och policyn finns för det steget. Att den står
tom påverkar inte utskicken — tystnadsfönstret räknar på `mejlad_at`.
