# Notiserna: konfiguration, drift och en ny typ

Systemet som mejlar familjer och studiehjälpare när något händer:
ett nytt pass, en flyttad tid, ett meddelande, en påminnelse dagen
före.

`DEPLOY-EPOST.md` handlar om aviseringen till ledningen när en
intresseanmälan kommer in, och om **SPF, DKIM och DMARC**. Den här
filen upprepar inte den. Står det inget om DNS här är det för att
det står där.

---

## Vägen ett mejl tar

```
trigger på bookings / messages / lesson_reports
  → intern.notis_skapa()   rad i notiser, syns i vyn
  → intern.notis_koa()     rad i notis_utskick, kön
  → pg_cron "notis-minut"  varje minut, notis_minut()
  → notis-ko               notis_utskick_ta() → Resend → notis_utskick_klar()
```

Databasen bestämmer, arbetaren skickar. `notis_utskick_ta()` har
redan prövat mottagarens val, om passet fortfarande är bokat, om
chatten lästs och om utskicket är för sent, och har redan valt
adressen. I `notis-ko` finns ingen affärslogik kvar.

**Ett misslyckat mejl blockerar aldrig användarens åtgärd.** Raden
skrivs, triggern köar, och allt efter det sker i bakgrunden.

Omförsök: raden lånas i fem minuter, får fem försök, och nästa
försök skjuts upp `försök²` minuter (1, 4, 9, 16, 25). Efter femte
försöket blir status `fel` och raden står kvar för granskning.

---

## 1. Secrets

Project Settings → Edge Functions → Secrets:

| Namn | Behövs av | Värde |
|------|-----------|-------|
| `RESEND_API_KEY` | alla mejl | API-nyckeln från Resend |
| `ELKS_API_ANVANDARE` | bara SMS | 46elks användarnamn |
| `ELKS_API_LOSENORD` | bara SMS | 46elks lösenord |

`SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY` injicerar Supabase
själv. **Lägg aldrig `service_role` i en klientfil.**

Saknas `RESEND_API_KEY` tar `notis-ko` inte en enda rad ur kön. Det
är med flit: hade den tagit raderna först och upptäckt det sedan
hade varje rad bränt ett av sina fem försök på något som rättas på
ett ställe.

---

## 2. En flagga och tre tabeller styr systemet

Allt fyra ändras under **System → Notiser** i adminvyn. Ingen av
tabellerna har en skrivpolicy för vanliga användare; admin har både
policy och kolumnrättigheter, så vyn räcker och SQL behövs inte.

### `flaggor` — strömbrytaren

| Kod | Vad |
|---|---|
| `notiser_mejl` | av ⇒ **inget notismejl lämnar systemet** |
| `notiser_sms` | av ⇒ inga SMS, och på räcker inte heller: `sms_lage` måste stå på `skicka` |

**Det här är det första stället att titta när ingenting kommer fram.**
Står `notiser_mejl` av lämnar `notis_utskick_ta()` inte ut en enda
mejlrad — raden märks `loggad`, notisen syns i vyn, och triggrarna,
kön, schemat och arbetaren fortsätter se friska ut, för det är de.
Flaggan stod av i månader efter Runda 2 utan att det gick att se
någonstans i produkten. Ett avstängt system och ett trasigt system ser
likadana ut inifrån.

`loggad` är ett slutläge. Mejlen som aldrig gick under en avstängning
går inte att skicka i efterhand, och ska inte heller — en påminnelse om
ett pass förra veckan är inte en notis.

Varje flagga bär också `vantar_pa`: vad som ska vara avgjort innan
någon slår på den. Adminvyn visar den texten i rutan man klickar ja i.

### `notis_konfig` — en rad, id = 1

| Kolumn | Vad |
|---|---|
| `hemlighet` | delas med triggrarna, skickas i `x-nextrum-notis` |
| `avregistreringsnyckel` | 32 byte base64, signerar avanmälningslänkarna |
| `arbetare_url` | adressen pg_cron väcker, `…/functions/v1/notis-ko` |

**Byter du `avregistreringsnyckel` slutar alla gamla
avanmälningslänkar gälla på en gång.** Inget annat händer. Det är
nödbromsen om en nyckel läckt.

Hemligheten ligger i en tabell och inte i en secret av ett skäl som
kostat en gång: en secret och en webhook-header i två olika fönster
glider isär, och funktionen svarar då 401 på varje anmälan emellan.
I en tabell byts båda i samma transaktion.

### `notis_installning` — takten

| Kolumn | Förval | Vad |
|---|---|---|
| `paminnelser_timmar` | `{24,1}` | hur långt före ett pass påminnelser går |
| `chatt_samla_minuter` | `10` | flera meddelanden i en tråd blir ett mejl |
| `pass_samla_minuter` | `3` | flera ändringar på samma pass blir ett mejl |

Samlingen sker i databasen genom `samlingsnyckel`, inte i arbetaren.
Fem repliker på tre minuter blir ett mejl — och den som får fem mejl
slutar läsa det sjätte.

### `notis_drift` — sandlådan och SMS

| Kolumn | Förval | Vad |
|---|---|---|
| `mejl_sandlada` | `null` | är den satt går ALLA mejl dit i stället |
| `sms_lage` | `prov` | allt som inte är `skicka` torrkör |
| `sms_tak_per_dygn` | `50` | tak innan SMS slutar gå |

---

## 3. Utveckla utan att skicka något

**Sätt sandlådan först. Gör det innan du rör något som köar.**
Enklast i adminvyn: **System → Notiser → Sandlådan**. Med SQL:

```sql
update public.notis_drift set mejl_sandlada = 'du@example.se' where id = 1;
```

Då går varje mejl dit i stället för till mottagaren, ämnesraden märks
`[Prov till familj]` eller `[Prov till studiehjälpare]`, och
avregistreringslänken stängs av — en äkta länk i ett prov hade
stängt av familjens mejl på riktigt.

Tillbaka till skarpt läge:

```sql
update public.notis_drift set mejl_sandlada = null where id = 1;
```

Ett enstaka provmejl till dig själv, utan att köa något:

```sql
select public.notis_provmejl('parent');   -- eller 'tutor'
```

### Proven kör utan databas och utan nät

```
deno test --allow-env supabase/functions/_delad/
```

Mallarna, vitlistan, tokenen, avanmälningen och hela kö-arbetaren
provas med en låtsaskö och en låtsas-Resend. **Inget anrop lämnar
maskinen.** Det är därför `_delad/notiser/ko.ts` tar sina beroenden
inskickade i stället för att importera Supabase.

### Se ett mejl med egna ögon

```
deno eval --ext=ts '
import { renderaKvitto } from "./supabase/functions/_delad/notiser/kvitto.ts";
Deno.writeTextFileSync("/tmp/mejl.html", renderaKvitto("Anna").html);'
```

Öppna `/tmp/mejl.html` i en webbläsare. Byt `renderaKvitto` mot
`renderaMejl` för notismejlen, eller mot
`renderaAnsokan({ steg: "mote", namn: "Tove", moteTid: "2026-10-02T15:00:00Z", moteLank: "https://meet.google.com/abc-defg-hij" })`
ur `ansokan.ts` för mejlen till den som sökt jobb.

---

## 4. DNS

Står i **`DEPLOY-EPOST.md`**, avsnitt 1 och 2: SPF på
`send.nextrum.se`, DKIM på `resend._domainkey`, DMARC på `_dmarc`,
plus två fällor som kostade en kväll var.

> ### DMARC: en post på `_dmarc` sedan 2026-09-24
>
> Det låg länge två, och två poster är inte dubbel DMARC — det är
> **noll**: en mottagare som hittar mer än en giltig post hoppar över
> hela kontrollen. Den utan `rua=` är borttagen. Policyn är fortfarande
> `p=none`; vägen till `quarantine` står i `DEPLOY-EPOST.md` avsnitt 5.

Notismejlen skickas från `no-reply@nextrum.se` med svara-till
`info@nextrum.se`. Kvittot på en intresseanmälan och mejlen till den
som sökt jobb skickas från `info@nextrum.se`, eftersom de ber om svar.
Alla ligger under samma domän och täcks av samma poster.

---

## 5. Lägga till en ny notistyp

Fem steg, i den här ordningen. Hoppar du över något av de tre första
kommer felet ut som `okänd notistyp` ur en trigger, mitt i något
annat.

**1. Databasen.** Lägg typen i `notis_typer()`, och i
`notis_mejlbara()` om den ska mejlas (en typ kan finnas bara i vyn —
`rapport` gör det). Ny migration, som allt annat; ändra inte en körd.

**2. `_delad/notiser/typer.ts`.** Lägg samma sträng i `NOTIS_TYPER`
och eventuellt `MEJLBARA`. **Listorna finns på två ställen med flit**
— mallarna ska gå att prova utan databas — men de måste ändras i
SAMMA ändring. `typer_test.ts` faller om de glider isär.

**3. `_delad/notiser/mallar.ts`.** En rad i `KATEGORI` (används i
foten: "… där mejl om {kategori} är påslaget") och en funktion i
`MALLAR` som ger ämne, rubrik, en mening, en knapp och en faktaruta.

**3b. `nextrum-studie.js`, listan `NOTISVAL`.** En rad med namn och en
kort förklaring, annars går typen inte att stänga av under
**Profil → Notiser**. Glöms den syns notisen i mejlet men inte i
inställningen, och den enda vägen bort blir länken i foten — som bara
kan stänga av, aldrig slå på igen.

Mallen ser bara `RenData`. Behöver den ett fält som inte finns där
är det `renData()` i `typer.ts` som ska ändras — och då ska du fråga
dig om fältet verkligen hör hemma i ett mejl. Den vitlistan är
sekretessen.

**4. Den som köar.** En trigger, eller en gren i
`notis_vid_pass()` / `notis_vid_meddelande()`, som anropar
`intern.notis_skapa()`.

**5. Proven.** `rendera_test.ts` går igenom alla `MEJLBARA`
automatiskt, så den nya typen provas av läckageprovet utan att du
skriver något. Har den egen logik: lägg ett eget prov.

### Innan du skriver mallen

Tre regler som inte är förhandlingsbara:

- **Ingen brödtext.** Mejlet säger ATT något hänt, aldrig VAD. Det
  kan gälla ett barns skolgång, och ett mejl ligger kvar i inkorgar
  vi inte styr över.
- **Aldrig vem som gjorde ändringen.** När admin ändrar ett pass får
  båda parterna notisen, och "Tove har flyttat passet" är då fel för
  den ena. Skriv passivt.
- **Ingen får en notis om sin egen åtgärd.** Det sköter
  `intern.notis_skapa()`, men skriv inte en mall som förutsätter
  motsatsen.

---

## 6. När något inte kommer fram

**System → Notiser i adminvyn svarar på alla fyra frågorna nedan på
en skärm** — flaggan, sandlådan, schemat, kön och de tio senaste
körningarna. Börja där. Med SQL, i den här ordningen:

| Vad | Fråga |
|---|---|
| Strömbrytaren | `select kod, aktiv from flaggor;` |
| Kön | `select status, count(*) from notis_utskick group by 1;` |
| Körningarna | `select * from notis_korningar order by tid desc limit 10;` |
| Felen | `select * from notis_fel order by skapad desc limit 20;` |
| Schemat | `select jobname, active from cron.job;` |

`notis_korningar.meddelande` är det första stället att läsa. Den
säger om körningen avbröts på ett kontofel hos Resend, om
tidsgränsen nåddes, och hur många rader som lämnades tillbaka.

Vanliga svar:

- **Allt i kön står `loggad` och `notis_korningar` visar noll
  behandlade** — flaggan `notiser_mejl` är av. Arbetaren väcks, får
  noll rader och rapporterar noll, för databasen märkte raderna innan
  den lämnade ut dem. Ingenting är trasigt; ingenting är påslaget.

- **`Resend 401` eller `403`** — nyckeln eller avsändardomänen.
  Gäller varje mejl, så körningen avbryts med flit i stället för att
  bränna hela kön på samma svar.
- **401 från arbetaren** — hemligheten i `notis_konfig` stämmer inte
  med det pg_cron skickar. Eller: någon körde `supabase functions
  deploy` utan `supabase/config.toml`, varpå JWT-kravet slogs på
  igen. **Filen finns i repot just för att hindra det.**
- **Inget alls händer** — `select * from cron.job` och se att
  `notis-minut` är aktiv, och att `notis_konfig.arbetare_url` pekar
  rätt.
- **Mejl går men ingen får dem** — kolla `notis_drift.mejl_sandlada`.
  Den kan ha blivit kvar efter ett prov.
- **Kvittot på en intresseanmälan uteblev** — det är förmodligen med
  flit. `lead-notis` bromsar av tre skäl, och skriver alltid varför i
  funktionsloggen:
  - samma adress har redan anmält sig det senaste dygnet (jämfört utan
    skiftläge och plustillägg: `anna+1@gmail.com` är samma inkorg som
    `anna@gmail.com`)
  - det har kommit fler än fem anmälningar den senaste minuten
  - det har kommit fler än tjugo den senaste timmen

  Reglerna räknas i databasen av `lead_kvitto_broms()` (Fas 16.2), med
  samma jämförelse som ansökningskvittot. `leads` tar emot INSERT från
  vem som helst — det är meningen, formuläret är publikt. Utan broms
  kunde vem som helst posta rader i en slinga med en adress de valt och
  få oss att mejlbomba en utomstående från vår egen domän.
  **Aviseringen till er går ut i alla fallen**, så att en människa ser
  att något pågår.

  Går kontrollen inte att göra skickas inget kvitto. En broms som
  släpper igenom när den är trasig är ingen broms.
- **Mejlet till den som sökt jobb uteblev** — öppna Rekryteringen på
  ansökan i adminvyn. Varje steg visar sitt mejl: mejlat, på väg, gick
  inte fram (med Resends statuskod) eller skickades inte (och varför).
  Frågan bakom är

  ```sql
  select steg, status, forsok, fel, skapad, uppdaterad
    from ansokan_utskick where ansokan_id = '…' order by skapad;
  ```

  `bromsad` är med flit, av samma skäl som kvittot ovan plus ett tak
  på tjugo ansökningar i timmen; skälet står på raden. `hoppad`
  betyder att ansökan hann avböjas eller mötet få en nyare tid innan
  mejlet gick. Saknas raden helt har steget inget mejl: kontakten och
  ett nej skriver admin själv. Står raden på `vantar` utan att röra
  sig: kontrollera `notis_konfig.ansokan_url` och att
  `ansokan-besked` finns i `cron.job`.

  **De här mejlen går inte genom sandlådan och inte genom flaggan
  `notiser_mejl`**, precis som kvittot på en intresseanmälan. De är
  inte notiser utan besked om något mottagaren själv satt igång. Prova
  dem med en ansökan i ditt eget namn och din egen adress, och ta bort
  raden efteråt.
