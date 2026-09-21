# Arkiv: edge-funktioner som låg i driften utan att ha funnits i git

## Ersatt i program 2, Fas 2

Arkivet beskriver den kod som låg i driften under namnen `notis-ko` och
`notis-avanmal` **före Fas 2**. Namnen tas över: den nya koden ligger i
`supabase/functions/notis-ko/` och `supabase/functions/notis-avanmal/`
och driftsätts under samma namn, så att den gamla versionen ersätts i
stället för att ligga kvar bredvid. Arkivet står kvar som historik och
som svar på frågan "vad låg där förut".

**Det här togs med:**

| Från arkivet | Nu i |
|---|---|
| Förnamnsregeln i `rendera.ts` (bara bokstäver, aldrig brödtext, rendera tar bara emot det den ska) | `_delad/notiser/typer.ts` (`fornamn`, `renData`), samma regel som `intern.fornamn()` i databasen |
| HMAC-token med konstant jämförelse | `_delad/notiser/token.ts` |
| `List-Unsubscribe` och `List-Unsubscribe-Post: List-Unsubscribe=One-Click` | `_delad/notiser/ko.ts` |
| Idempotensnyckeln `nextrum-notis-<id>` | `_delad/notiser/ko.ts` |
| Beroendeinjektion i arbetaren, så att flödet går att testa utan Supabase och Resend | `_delad/notiser/ko.ts` och `ko_test.ts` |
| Fältet `headers` i `Mejl` | `_delad/mejl.ts` (valfritt, befintliga anropare oförändrade) |
| Bara POST i notis-avanmal avregistrerar, GET gör det inte | `_delad/notiser/avanmal.ts` (GET och HEAD skickas nu vidare med 303 till `nextrum.se/avanmal`, se nedan) |

**Det här ändrades:**

- **Databasen.** Den nya koden talar bara med funktionerna från Fas 2.3:
  `notis_utskick_ta`, `notis_utskick_klar`, `notis_arbetare_klar`,
  `notis_avregistreringsnyckel` och `notis_avregistrera`. `notis_hamta`,
  `notis_klar`, `notis_avanmal`, tabellen `notis_ko` och kolumnerna
  `notis_konfig.lage` och `notis_konfig.avanmal_nyckel` används inte
  och skapas inte.
- **Vem som bestämmer.** Den gamla arbetaren prövade själv om mottagaren
  ville ha mejl (en global `notismail`). Nu prövar databasen varje rad
  när den tas ur kön (flaggan, valet per typ och kanal, om passet
  fortfarande är bokat, om chatten redan är läst, om det är för sent),
  och arbetaren skickar bara det den får.
- **Tokenen, version 2.** `<uid>.<kanal>.<typ>.<signatur>` över
  `avanmal:v2:uid:kanal:typ`, där typ är en notistyp eller `alla`. Den
  gamla signerade bara `avanmal:uid` och stängde av allt. Nyckeln är
  32 byte ur `notis_konfig.avregistreringsnyckel`, som bara service_role
  läser. Gamla tokens gäller inte: det har aldrig gått ut något mejl
  med en sådan.
- **Läget.** Varken secreten `NOTIS_LAGE` eller `notis_konfig.lage`
  finns kvar. Mejl styrs av flaggan `notiser_mejl` och sandlådeadressen
  i `notis_drift`, SMS av flaggan `notiser_sms` och `notis_drift.sms_lage`
  (`prov` = 46elks dryrun). Allt läses i databasen.
- **Inget mejl utan avregistrering.** Den gamla skickade utan länk om
  nyckeln saknades. Den nya tar inget ur kön om nyckeln inte går att
  läsa.
- **Avsändaren** är `Nextrum <no-reply@nextrum.se>` med svar till
  `info@nextrum.se`, som dagens notiser. Den gamla hade `info@` som
  förval.
- **Mallarna** skrevs om: en per typ och roll ur Fas 2 (nytt pass,
  bekräftat, flyttat, avbokat, avböjt, meddelande, påminnelse), med
  datum, tid, ämne och förnamn. Jordpaletten ur `nextrum-cinema.css`,
  systemtypsnitt, ingen Google Fonts och ingen bildlogga (den gamla
  pekade på `/mejl-mark.png`, som inte finns).
- **SMS** finns nu, bara för påminnelser, via 46elks (`_delad/sms.ts`).
- **Resend-felen.** 401 och 403 gäller kontot (nyckeln eller
  avsändardomänen), inte mejlet: körningen avbryts, raden går tillbaka
  som tillfälligt fel, omgångens övriga mejl går tillbaka utan försök
  och skälet skrivs i `notis_korningar`. Funktionen svarar då 500, som
  när `RESEND_API_KEY` saknas. 408, 409 (krock på idempotensnyckeln),
  429 och 5xx prövas igen, som i den gamla. Övriga 4xx är permanenta.
  Den gamla räknade 403 som tillfälligt och fortsatte rad för rad; den
  första nya versionen räknade 403, 408 och 409 som permanenta och
  hade bränt hela kön på ett domänfel.
- **Tidsgränser.** En körning tar inga nya rader efter 15 sekunder och
  tar aldrig fler än hinner gå, eftersom `notis_minut()` bara väntar 20
  sekunder på svar. Varje anrop till Resend och 46elks får ta högst 8
  sekunder. Ett SMS som inte besvarades i tid i läget `skicka` blir ett
  permanent fel, eftersom 46elks saknar idempotensnyckel och det kan ha
  gått fram.
- **Mottagaren** står i svaret från `notis_utskick_ta` sedan 2.3d.
  Arbetaren läser aldrig `notis_utskick` direkt.
- **GET till notis-avanmal** skickas vidare med 303 till
  `https://nextrum.se/avanmal?t=<samma token>`. Adressen står i
  List-Unsubscribe, och mejlprogram som inte gör One-Click öppnar den i
  webbläsaren. Den gamla svarade 405; det gjorde också den första nya
  versionen, med rå JSON och ingen väg vidare. Vidareskickningen rör
  inte databasen.
- **Kroppen i notis-avanmal** läses med tak på 4096 byte, också utan
  `content-length`.
- **Inga råa fel utåt.** Den gamla notis-avanmal svarade med
  `String(e.message)` vid 500.

---

**Det här är inte levande kod.** Katalogen ligger med flit utanför
`supabase/functions/`, så att varken CI (`deno check
supabase/functions/*/index.ts`) eller en `supabase functions deploy`
tar den för en funktion att underhålla eller driftsätta. `.vercelignore`
utesluter hela `/supabase`, så inget här serveras från nextrum.se.

Koden hämtades 2026-09-21 ur Supabase med `get_edge_function`, eftersom
den inte fanns i någon gren — `git log --all --find-object` gav noll
träffar. Den skrevs av två gånger, oberoende av varandra, och de två
avskrifterna jämfördes med `diff -r`. `_delad/auth.ts` och
`_delad/http.ts` är dessutom byte för byte lika repots egna filer.
`META.json` i varje mapp bär driftversionens id, version och tidpunkt.

Varje mapp är en **hel bunt**, precis som den driftsattes: entrypointen
ligger på `<slug>/index.ts` relativt buntens rot, och `_delad/` är
buntens egen kopia. Därav den dubbla `notis-ko/notis-ko/`.

---

## Läget i driften, 2026-09-21 (före Fas 2)

| | notis-ko | notis-avanmal |
|---|---|---|
| Status | ACTIVE, version 1 | ACTIVE, version 1 |
| `verify_jwt` | **false** | **false** |
| Driftsatt | 2026-09-19 23:11 UTC | 2026-09-19 23:12 UTC |
| Anropad sedan dess | aldrig | aldrig |
| Vad den gör i dag | svarar 401, eller 500 med rätt hemlighet | svarar 503 på varje anrop |

**Ingen av dem kan skicka ett mejl, läsa data eller skriva något i dag.**
Ingen trigger, webhook, databasfunktion eller cron-jobb anropar dem, och
`pg_cron` är inte installerat. Loggarna visar fyra anrop totalt, alla
inom två minuter efter driftsättningen, från sessionen som driftsatte
dem.

---

## notis-ko

**Tänkt att göra:** köa notismejl i en tabell och skicka dem i
omgångar, i stället för att varje händelse mejlar direkt. Enligt
filhuvudet skulle den väckas varje minut av ett `pg_cron`-jobb som
heter `notis_vack_arbetaren`.

**Steg för steg** (`notis-ko/index.ts`, `notis-ko/arbetare.ts`):

1. `OPTIONS` ger 200.
2. Kräver `SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY`.
3. Saknas headern `x-nextrum-notis` → **401**, ingenting läses.
   Annars läses `notis_konfig.hemlighet` med service_role och jämförs i
   konstant tid. Fel värde → 401.
4. Läser `notis_konfig.avanmal_nyckel` och `notis_konfig.lage`. **Båda
   kolumnerna saknas**, felet ignoreras och konfigurationen blir tom.
5. Läget tas från secreten `NOTIS_LAGE`, annars `notis_konfig.lage`,
   annars `'logg'` — som betyder att inga riktiga mejl skickas.
6. Anropar `rpc notis_hamta(max_antal=25)`. **Funktionen saknas**, så
   svaret blir 500 här.
7. *Om kön hade funnits:* varje rad renderas ur `mallar/sv.json` och
   skickas via Resend med idempotensnyckeln `nextrum-notis-<id>` och
   `List-Unsubscribe`-headers, varefter `notis_klar(...)` anropas.

**Läser:** `notis_konfig` (hemlighet, avanmal_nyckel, lage).
**Skriver:** ingenting direkt — allt skulle gå via `notis_hamta` och
`notis_klar`.

**Databasobjekt den förutsätter, och som INTE finns:** tabellen
`notis_ko`, funktionerna `notis_hamta` och `notis_klar`, kolumnerna
`notis_konfig.lage` och `notis_konfig.avanmal_nyckel`, `pg_cron`.
Filhuvudet hänvisar till en migration "v26" som inte finns i någon gren.

**Miljövariabler och hemligheter:** `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIS_LAGE`,
`NOTIS_BAS_URL`, `NOTIS_FUNKTION_URL`, `NOTIS_LOGO_URL`,
`NOTIS_FRAN_EPOST` (förval `info@nextrum.se`), `NOTIS_FRAN_NAMN`,
`NOTIS_SVARA_TILL`, `NOTIS_SANDLADA_TILL`, samt hemligheten i
`notis_konfig.hemlighet`. Vilka av dem som är satta i Supabase går inte
att läsa med de verktyg som finns.

**Mallarna** (`_delad/notiser/mallar/sv.json`) täcker tio notistyper:
`intresse_bekraftelse`, `nytt_meddelande`, `nytt_tidsforslag`,
`andrad_tid`, `bekraftad_tid`, `ny_bokning`, `avbokad`, `ny_matchning`,
`paminnelse` ("pass i morgon") och `flera` (sammanslagningen "{antal}
saker"). `rendera.ts` tar bara emot förnamn, typ, antal och länk —
aldrig brödtext. Det är en bra princip att behålla.

## notis-avanmal

**Tänkt att göra:** ta emot klicket i ett mejls avregistreringslänk och
stänga av notismejl för användaren.

**Steg för steg** (`notis-avanmal/index.ts`, `_delad/notiser/token.ts`):

1. Annat än `POST` → 405. `POST` utan token `t` → 400.
2. Läser `notis_konfig.avanmal_nyckel` med service_role. **Kolumnen
   saknas** → **503** "Tjänsten är inte konfigurerad." Bekräftat i
   postgres-loggen som `42703` 2026-09-19 23:14 UTC.
3. *Om kolumnen hade funnits:* token = user_id + HMAC-SHA256 av
   `'avanmal:' + user_id` prövas, och `rpc notis_avanmal(p_user)` anropas.

**Läser:** `notis_konfig.avanmal_nyckel`. **Skriver:** ingenting direkt.

**Saknas:** kolumnen `avanmal_nyckel`, funktionen `notis_avanmal`,
kolumnen den skulle skriva till (`notismail`), och sidan
`https://nextrum.se/avanmal` som mejlets länk pekar på (svarar 404).
Token har ingen utgångstid. Avregistreringen är **global**, inte per
notistyp.

---

## Skillnad mot repots `_delad/`

| Fil | Mot `supabase/functions/_delad/` |
|---|---|
| `http.ts`, `auth.ts`, `konstanter.ts` | identiska |
| `mejl.ts` | driftens har fältet `headers?: Record<string,string>` i typen `Mejl`, och `skickaViaResend` skickar med det. Behövs för `List-Unsubscribe`. Påverkar inga andra anrop. |
| `notis.ts` | samma kod; repots har längre kommentarer |
| `notiser/*` | finns bara här |

---

## Den vilande risken (gäller tills de nya versionerna är driftsatta)

Båda de gamla funktionerna läser kolumnerna `avanmal_nyckel` och `lage` ur
`notis_konfig`. **En framtida migration som råkar lägga till kolumner
med de namnen räcker för att de ska vakna halvvägs.** Kommer
`notis_hamta` också till och `lage` sätts till `'skicka'`, skickar
notis-ko riktiga mejl från `info@nextrum.se` med kod som inte finns i
git — och med `verify_jwt` avstängt.

Därför: **använd inte de kolumnnamnen** i notis_konfig utan att först
ha bestämt vad som ska hända med de här två funktionerna.

## Konkurrerande design (före Fas 2)

Det finns en tredje notisdesign på grenen
`origin/claude/zealous-clarke-9pggx6` (commit `5b42e61`): edge-funktionen
`notis-mejl`, `_delad/mall.ts` och en migration som skapar
`public.notiser` med fem triggrar. Inget av det finns i driften.

Det finns alltså tre vägar för notiser:

1. **De tre webhookarna som körs i dag** — `lead-notis`, `pass-notis`,
   `meddelande-notis`
2. **Kön i det här arkivet** — `notis-ko` och `notis-avanmal`
3. **`notis-mejl` med `public.notiser`** — på en egen gren

Väg 2 och 3 överlappar väg 1. Körs två samtidigt får mottagaren dubbla
mejl. **Vilken som ska gälla avgörs före Fas 2.**

## ⚠ Om de tas bort: rör INTE `notis_konfig`

Att ta bort funktionerna bryter ingenting. Faran ligger i städningen som
är frestande att göra samtidigt.

`notis_konfig.hemlighet` är **samma hemlighet** som de tre levande
webhookarna använder. Den står i klartext i triggrarnas argument
(`pg_trigger.tgargs` för `ny-intresseanmalan`, `nytt-passforslag` och
`nytt-meddelande`), och `lead-notis` och `_delad/notis.ts` läser den
från tabellen. Tas `notis_konfig` bort, eller roteras hemligheten
"eftersom notis-ko kände till den", svarar alla tre med 401 eller 503.
Då går inga notiser alls: inte om intresseanmälningar, inte om pass,
inte om meddelanden.

Ska hemligheten någon gång roteras görs det i **en** transaktion som
byter både `notis_konfig.hemlighet` och alla tre triggrarnas header.
Roteringsblocket står i `supabase/migrations/arkiv/schema-v17.sql`.

## Vad som gäller efter Fas 2

- **Vägen:** kön, med nya namn i databasen och de gamla namnen på
  edge-funktionerna. `notis-mejl` på grenen zealous-clarke byggs inte
  vidare, och webhookarna `nytt-passforslag` och `nytt-meddelande` tas
  bort i Fas 2.2. `lead-notis` står kvar.
- **Borttagning eller övertagande:** övertagande. De nya versionerna
  driftsätts under samma namn, med `verify_jwt = false` kvar i
  `supabase/config.toml`. Driftsättningen är en driftändring och kräver
  ett uttryckligt ja.
- **Avregistreringen**, så som den är byggd, gäller per notistyp och
  kanal, eller `alla` för en kanal. Den kan bara stänga av. Den gäller
  notismejlen i kön; fakturorna i `faktura-utskick` och `lead-notis`
  till personalen går inte genom kön och berörs inte.
